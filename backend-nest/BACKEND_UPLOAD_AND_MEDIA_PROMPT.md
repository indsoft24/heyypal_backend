# Backend: File Upload, Storage & Media – Modification Prompt

Use this prompt when modifying or handing off the backend file upload and media pipeline.

## 1. Current Behaviour (Implemented)

- **Upload module** (`/api/upload/`):
  - `POST /api/upload/expert/photos` – JWT required, multipart field `photos`, 2–5 images, max 10 MB each. Saves under `uploads/expert-photos/`, returns `{ urls: string[] }`.
  - `POST /api/upload/expert/video` – JWT required, multipart field `video`, max 15 MB. Saves under `uploads/expert-videos/`, returns `{ url: string }`.
  - `POST /api/upload/expert/document` – JWT required, multipart field `document`, image or PDF, max 10 MB. Saves under `uploads/expert-documents/`, returns `{ url: string }`.
- **Storage**: Files saved under `UPLOAD_DIR` or `FILE_STORAGE_PATH` in subdirs `expert-photos/`, `expert-videos/`, `expert-documents/`. UUID filenames. No DB record for the file.
- **Serving**: Static files at `GET /uploads/*` (e.g. `/uploads/expert-photos/<uuid>.jpg`). Base URL from `API_PUBLIC_URL`.
- **Expert profile**: `POST /api/experts/profile` accepts `photos`, `introVideoUrl`, optional `introVideoCompressedUrl` (falls back to `introVideoUrl`), `degreeCertificateUrl`, `aadharUrl`.

## 2. Optional Extensions

- **S3/GCS**: Add SDK, upload buffer to bucket in `UploadService.saveFile()`, set `baseUrl` to bucket/CDN URL.
- **Video compression**: Enqueue job (Bull/RabbitMQ) after upload; run FFmpeg; update `intro_video_compressed` when done.
- **Agora webhook**: `POST /api/webhooks/agora-recording`, verify signature, store file via `UploadService`, return or attach URL to profile.
- **Security**: Keep JWT on all uploads; add rate limiting; optional virus scan (ClamAV); PII docs – admin-only or signed short-lived URLs.

## 3. Environment Variables

- `UPLOAD_DIR` – Local directory (default: `./uploads` or `FILE_STORAGE_PATH`).
- `API_PUBLIC_URL` – Public base URL of the API (e.g. `https://api.heyypal.com`), no trailing slash.
- S3: `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
