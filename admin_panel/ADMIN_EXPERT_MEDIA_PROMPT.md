# Admin Panel: Expert Media & Documents – Modification Prompt

Use this prompt to implement or refine how the **HeyyPal admin panel** displays expert **photos**, **intro video**, and **documents** (degree/certificate, Aadhaar).

---

## 1. Current Behaviour (Already Implemented)

- **Experts list** (`/dashboard/experts`): Each expert card shows:
  - User details (name, email, role, gender, DOB, etc.) and expert type (Supportive/Professional).
  - Expert profile: category, languages, short bio.
  - **Media & documents**:
    - **Professional photos**: Thumbnail gallery (e.g. 80×80px) for each URL in `profile.photos`. Each image is a link opening the full image in a new tab.
    - **Intro video**: A `<video>` player with `controls`, using `profile.intro_video_compressed_url` or falling back to `profile.intro_video_url`. Player is constrained (e.g. max height 12rem) and rounded.
    - **Professional experts**: Links to open **degree/certificate** and **Aadhaar** in a new tab (`profile.degree_certificate_url`, `profile.aadhar_url`).
- **API**: `GET /api/admin/experts` returns experts with nested `profile` including `photos`, `intro_video_url`, `intro_video_compressed_url`, `degree_certificate_url`, `aadhar_url`. All are full URLs (from backend `API_PUBLIC_URL` + `/uploads/...` or cloud).

---

## 2. What You May Need to Add or Change

### 2.1 Photo gallery

- **Goal**: Professional, easy-to-scan display of expert photos.
- **Options**:
  - Keep current thumbnail strip; add a lightbox/modal so admins can click a thumbnail to see full size and optionally cycle through all photos.
  - Use a grid (e.g. 3 columns) with consistent aspect ratio and lazy loading.
- **Edge cases**: If `profile.photos` is empty or null, show "No photos" or hide the section. If a URL fails to load, show a placeholder and optionally a "Open link" fallback.

### 2.2 Intro video

- **Goal**: Reliable playback and good UX.
- **Options**:
  - Prefer `intro_video_compressed_url` for faster load; fallback to `intro_video_url`. Use `preload="metadata"` to avoid loading full video until play.
  - Add a direct "Open in new tab" link for the video URL for download or external playback.
- **Edge cases**: If both URLs are missing, show "No intro video". If CORS blocks playback, show the link only and instruct admin to open in new tab.

### 2.3 Documents (degree, Aadhaar)

- **Goal**: Clear, secure access for admins.
- **Options**:
  - Keep "Degree/certificate" and "Aadhaar" as links that open in a new tab. For PDFs the browser will open or download; for images the image will display.
  - Optional: Embed PDFs in an iframe or use a PDF viewer component on the same page; ensure only admins can access (backend should enforce auth and optionally short-lived signed URLs).
- **Security**: Do not expose document URLs to non-admin users. Admin API is already protected; ensure no public link leaks (e.g. in client-side routing or logs).

### 2.4 Layout and responsiveness

- **Goal**: Usable on desktop and tablet.
- **Suggestions**:
  - Use a clear section order: User info → Expert profile (bio, category, languages) → Media (photos, video) → Documents (if professional) → Actions (Approve/Reject).
  - Use responsive grid/flex so that on small screens the media block stacks or wraps without horizontal scroll.

### 2.5 Loading and errors

- **Goal**: Clear feedback when media fail to load or API fails.
- **Suggestions**:
  - On API error, show a message and retry option.
  - For images, use `onError` to show a placeholder; for video, show a message or link if `error` event fires.
  - Optional: Show a small loading state for the experts list and for media (e.g. skeleton for images/video).

---

## 3. API Contract (Reference)

- **Expert profile** (from `GET /api/admin/experts`):
  - `profile.photos`: `string[] | null` – full URLs of professional photos.
  - `profile.intro_video_url`: `string | null` – original intro video URL.
  - `profile.intro_video_compressed_url`: `string | null` – compressed intro video URL (prefer for playback).
  - `profile.degree_certificate_url`: `string | null` – degree/certificate document URL (professional only).
  - `profile.aadhar_url`: `string | null` – Aadhaar document URL (professional only).

All URLs are absolute. If the backend uses a different host (e.g. CDN) for uploads, these URLs will point to that host; no change needed in the admin other than handling CORS if video is embedded.

---

## 4. Acceptance Criteria

- Admin can see all expert photos in a clear gallery (thumbnails + optional full-size view).
- Admin can play the intro video in-page with a fallback link.
- Admin can open degree/certificate and Aadhaar in a new tab (or optional embedded viewer).
- Layout is clear and works on different screen sizes.
- Failed media or API errors are handled without breaking the page.

Use this prompt when modifying or handing off the admin expert media and documents UI.
