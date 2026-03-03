# Admin Panel: Expert Media & Documents – Modification Prompt

Use this prompt when modifying how the HeyyPal admin panel displays expert photos, intro video, and documents.

## 1. Current Behaviour (Implemented)

- **Experts list** (`/dashboard/experts`): Each expert card shows:
  - User details, expert type, profile (category, languages, bio).
  - **Photos**: Thumbnail gallery (80×80px) for `profile.photos`; each thumbnail links to full image in a new tab. Placeholder on load error.
  - **Intro video**: `<video>` with controls, `preload="metadata"`; uses `intro_video_compressed_url` with fallback to `intro_video_url`. “Open in new tab” link.
  - **Documents** (professional): Links to open Degree/certificate and Aadhaar in a new tab.

## 2. API Contract

- `GET /api/admin/experts` returns experts with nested `profile`:
  - `profile.photos`: `string[] | null`
  - `profile.intro_video_url`, `profile.intro_video_compressed_url`: `string | null`
  - `profile.degree_certificate_url`, `profile.aadhar_url`: `string | null`

All URLs are absolute (from backend `API_PUBLIC_URL` + `/uploads/...` or cloud).

## 3. Optional Improvements

- **Photo gallery**: Lightbox/modal for full-size view; grid layout; lazy loading.
- **Video**: If CORS blocks playback, show link only and “Open in new tab”.
- **Documents**: Optional embedded PDF viewer; ensure admin-only access and no URL leakage.

## 4. Acceptance Criteria

- Admin sees expert photos (thumbnails + link to full).
- Admin can play intro video in-page with fallback link.
- Admin can open degree/certificate and Aadhaar in a new tab.
- Layout works on desktop and tablet; errors (API or media load) are handled without breaking the page.
