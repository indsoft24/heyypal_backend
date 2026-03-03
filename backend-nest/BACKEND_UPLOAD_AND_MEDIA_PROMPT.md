# Backend: File Upload, Storage & Media – Modification Prompt

Use this prompt to implement or extend the HeyyPal backend for **expert photo/video/document uploads**, **storage**, and **optional Agora/video processing**.

---

## 1. Current Behaviour (Already Implemented)

- **Upload module** (`/api/upload/`):
  - `POST /api/upload/expert/photos` – multiple images (field `photos`), 2–5 files, max 10 MB each. Returns `{ urls: string[] }`.
  - `POST /api/upload/expert/video` – single intro video (field `video`), max 15 MB. Returns `{ url: string }`.
  - `POST /api/upload/expert/document` – single file (field `document`), image or PDF, max 10 MB. Returns `{ url: string }`.
- **Storage**: Files are saved under `uploads/` (or `UPLOAD_DIR`) in subdirs `expert-photos/`, `expert-videos/`, `expert-documents/`. Each file is stored with a UUID filename. No database record for the file itself.
- **Serving**: Static files are served at `/uploads/*` (e.g. `GET /uploads/expert-photos/<uuid>.jpg`). Base URL for responses is set via `API_PUBLIC_URL` (e.g. `http://localhost:5001` or your public API host).
- **Expert profile**: `POST /api/experts/profile` accepts `photos`, `introVideoUrl`, `introVideoCompressedUrl` (optional), `degreeCertificateUrl`, `aadharUrl` as strings (URLs). The app uploads files first, then submits these URLs.

---

## 2. What You May Need to Add or Change

### 2.1 Cloud storage (S3 / GCS)

- **Goal**: Store files in S3 (or GCS) instead of local disk so that uploads scale and survive restarts.
- **Steps**:
  - Add SDK (e.g. `@aws-sdk/client-s3`) and config (bucket, region, credentials).
  - In `UploadService.saveFile()` (or equivalent), after validating the file, upload the buffer to the bucket with a key like `expert-photos/<uuid>.<ext>`.
  - Set `baseUrl` to the public base for the bucket (e.g. `https://<bucket>.s3.<region>.amazonaws.com` or a CDN URL). Return URLs in the form `{baseUrl}/{key}`.
  - Keep the same API contract: same endpoints, same response shapes `{ urls }` / `{ url }`.

### 2.2 Video compression (intro video)

- **Goal**: Generate a compressed version of the intro video for fast playback in admin and app.
- **Options**:
  - **A – Background job**: After saving the original (e.g. to `expert-videos/` or S3), enqueue a job (e.g. Bull/RabbitMQ) that runs FFmpeg (or a cloud transcoder), writes the compressed file, then updates `expert_profiles.intro_video_compressed` (and optionally the same URL in a cache).
  - **B – Synchronous**: Only if acceptable for your scale: run FFmpeg in-process or in a subprocess after upload, save compressed file, return both URLs in the upload response. Prefer A for production.
- **Contract**: Expert profile already has `introVideoUrl` and `introVideoCompressedUrl`. If compression runs async, keep `introVideoCompressedUrl` null until the job completes; admin/app can fall back to `introVideoUrl`.

### 2.3 Agora Cloud Recording (optional)

- **Goal**: If the app uses Agora to record the intro in a "solo" channel, you may receive a webhook when recording stops and a file is ready.
- **Steps**:
  - Add a webhook route (e.g. `POST /api/webhooks/agora-recording`) that verifies the request (Agora signature/secret), parses the recording result (e.g. file URL or path).
  - Download the file (or get a permanent URL), store it via your existing `UploadService` (or S3) under `expert-videos/`, and either create/update an expert profile or return the URL for the client to send in `POST /api/experts/profile`.
  - Do not expose sensitive Agora credentials; validate webhook payloads.

### 2.4 Security and validation

- **Auth**: All upload endpoints must remain behind `JwtAuthGuard` (app user token). Do not allow unauthenticated uploads.
- **Rate limiting**: Add rate limits per user on upload endpoints to avoid abuse.
- **Virus scanning**: For production, consider scanning uploaded files (e.g. ClamAV or a cloud scanner) before saving and before returning URLs.
- **PII**: Degree/certificate and Aadhaar are sensitive. Restrict access (e.g. only admin or the owning user), and consider encryption at rest and short-lived signed URLs for download.

### 2.5 Admin API

- **Goal**: Admin already receives full expert data including `profile.photos`, `profile.intro_video_url`, `profile.intro_video_compressed_url`, `profile.degree_certificate_url`, `profile.aadhar_url`.
- **Change**: If you move to S3 or another base URL, ensure `API_PUBLIC_URL` (or equivalent) is set so that these URLs are absolute and reachable from the admin panel (and that CORS allows the admin origin if needed).

---

## 3. Environment Variables

- `UPLOAD_DIR` – Local directory for uploads (default: `./uploads`).
- `API_PUBLIC_URL` – Public base URL of the API (e.g. `https://api.heyypal.com`), used to build file URLs. Must not end with a slash.
- For S3: e.g. `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (or IAM role).

---

## 4. Acceptance Criteria

- App can upload 2–5 photos, one video, and (for professional experts) degree + Aadhaar.
- Backend returns stable, publicly reachable URLs (local or cloud).
- Expert profile submission stores these URLs; admin can list experts and see all media.
- Optional: Compressed intro video and/or Agora webhook integration as above.
- Upload endpoints stay protected and, if needed, rate-limited and scanned.

Use this prompt when modifying or handing off the backend file upload and media pipeline.
