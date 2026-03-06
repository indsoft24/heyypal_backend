# HeyyPal Backend — Schema & API Documentation

Technical reference for data models, REST APIs, WebSocket events, storage keys, and architectural approach. All endpoints are under the **global prefix** `api` (e.g. `POST /api/auth/google`).

---

## 1. Architecture & Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js |
| **Framework** | NestJS 10.x |
| **REST** | Express, global prefix `api` |
| **Validation** | class-validator + class-transformer; ValidationPipe (whitelist, transform, forbidNonWhitelisted) |
| **Documentation** | Swagger/OpenAPI at `/api/docs`, Bearer auth |
| **Relational DB** | PostgreSQL (TypeORM), `synchronize: true` in non-production |
| **Document DB** | MongoDB (Mongoose), database name `heyypal` |
| **Cache/Presence** | Redis (ioredis) |
| **Message Queue** | RabbitMQ (optional) |
| **WebSockets** | Socket.IO (custom adapter), namespaces `/call`, `/chat` |
| **Auth** | JWT (access + refresh), Google ID token verification, Passport strategies |
| **Real-time voice** | Agora RTC tokens (server-generated); signaling via Call WebSocket |
| **Push** | Firebase Admin (FCM) for chat notifications |
| **File storage** | Configurable: local filesystem (`UPLOAD_DIR` / `FILE_STORAGE_PATH`) or external (Bunny/VPS) via `StorageProvider`; media served via `GET /api/media/*` by key |

**Environment:** `.env` / `.env.local`; CORS via `CORS_ORIGIN` (comma-separated); `NODE_ENV` used for DB sync and behavior.

---

## 2. Glossary (Technical Terms)

- **Access token** — Short-lived JWT in `Authorization: Bearer <token>`; payload includes `sub` (user id), `email`, `role`, `expertStatus`, `profileCompleted`.
- **Refresh token** — Opaque token stored hashed in `refresh_tokens`; used to obtain new access + refresh pair.
- **Profile completion** — Boolean on `users.profile_completed`; when false, app should force Complete Profile screen; derived from name, phone, role.
- **Expert onboarding** — Step 3 (final): expert_profiles row with min 2 photos, intro video, and for professional type degree + aadhar; source of truth is `GET /api/experts/me/onboarding-status`.
- **Expert status** — `users.expert_status`: `pending` | `approved` | `rejected`; only `approved` experts appear in discover/detail.
- **Expert type** — `supportive` | `professional`; professional requires degree certificate and Aadhar URLs.
- **Call session** — Ephemeral call state in MongoDB `call_sessions`; lifecycle: initiated → ringing → connected | ended | rejected | timeout.
- **Call log** — Persistent record in PostgreSQL `call_logs` (UUID id, caller/receiver, status, duration, etc.).
- **Storage key** — Logical path for a file (e.g. `profile/user/1/photo1.jpg`); no full URL in DB; URLs built by storage service or `GET /api/media/<key>`.
- **FCM token** — Firebase Cloud Messaging token stored on `users.fcm_token` for push (e.g. chat).
- **PII** — Phone stored encrypted at rest in `users.phone` (column `phone`; value is `phoneEnc` in code).

---

## 3. Data Stores & Entity Schemas

### 3.1 PostgreSQL (TypeORM)

**Database:** `POSTGRES_DB` (default `heyypal`). Entities use snake_case column names where specified.

#### 3.1.1 `users`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int, PK, auto | User id |
| `google_id` | varchar, unique, nullable | Google OAuth sub |
| `name` | varchar, nullable | Display name |
| `email` | varchar, unique, nullable | Email |
| `phone` | varchar, nullable | Encrypted phone (PII) |
| `role` | enum | `user` \| `expert` \| `admin` |
| `expert_status` | enum, nullable | `pending` \| `approved` \| `rejected` (for experts) |
| `expert_type` | varchar(20), nullable | `supportive` \| `professional` |
| `gender` | varchar(20), nullable | |
| `date_of_birth` | varchar(20), nullable | |
| `profile_completed` | smallint (0/1) | Mapped to boolean |
| `profile_photo_1_key` | varchar(255), nullable | Storage key only |
| `profile_photo_2_key` | varchar(255), nullable | Storage key only |
| `fcm_token` | varchar(255), nullable | FCM for push |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Enums:** `UserRole`, `ExpertStatus`, `ExpertType` (see code).

#### 3.1.2 `refresh_tokens`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int, PK | |
| `user_id` | int, FK → users | CASCADE on delete |
| `token_hash` | varchar, nullable | SHA-256 of refresh token |
| `expires_at` | timestamp, nullable | |
| `created_at` | timestamptz | |

#### 3.1.3 `expert_profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int, PK | |
| `user_id` | int, FK → users | |
| `type` | enum | ExpertType |
| `category` | enum | ExpertCategory (e.g. Fitness, Emotional help, …) |
| `bio` | varchar(300), nullable | |
| `languages_spoken` | simple-array | String array |
| `photos` | simple-array, nullable | Array of storage keys/URLs (legacy) |
| `intro_video` | varchar, nullable | Intro video URL/key |
| `intro_video_compressed` | varchar, nullable | |
| `degree_certificate` | varchar, nullable | Document URL/key (professional) |
| `aadhar` | varchar, nullable | Document URL/key (professional) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**ExpertCategory enum:** Fitness, Emotional help, Relationships, Skincare, Comfort Zone, Fashion, Comedian, Story Telling.

#### 3.1.4 `expert_videos`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid, PK | |
| `user_id` | int, FK → users | CASCADE |
| `video_key` | varchar(255) | Storage key |
| `thumbnail_key` | varchar(255), nullable | |
| `duration` | int | Seconds |
| `status` | enum | `pending` \| `approved` \| `rejected` |
| `created_at` | timestamptz | |
| `approved_at` | timestamp, nullable | |

#### 3.1.5 `messages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int, PK | |
| `sender_id` | int, FK → users | |
| `receiver_id` | int, FK → users | |
| `content` | text | |
| `is_read` | boolean, default false | |
| `is_delivered` | boolean, default false | |
| `created_at` | timestamptz | |

#### 3.1.6 `call_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid, PK | |
| `call_session_id` | varchar(64) | Links to MongoDB call_sessions |
| `caller_id` | int | |
| `receiver_id` | int | |
| `call_status` | varchar(24) | initiated, ringing, connected, ended, rejected, busy, missed, timeout |
| `start_time` | timestamptz, nullable | |
| `end_time` | timestamptz, nullable | |
| `duration_seconds` | int, default 0 | |
| `call_type` | varchar(16), default 'audio' | |
| `missed_flag` | boolean, default false | |
| `created_at` | timestamptz | |

Indexes: `(caller_id, created_at)`, `(receiver_id, created_at)`.

#### 3.1.7 `admin_users`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int, PK | |
| `name` | varchar, nullable | |
| `email` | varchar, unique, nullable | |
| `password_hash` | varchar, nullable | |
| `role` | enum | `admin` \| `seller` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### 3.2 MongoDB (Mongoose)

**Database:** `heyypal`, collection `call_sessions`.

#### 3.2.1 CallSession

| Field | Type | Description |
|-------|------|-------------|
| `callSessionId` | string, required, unique | Session identifier |
| `callerId` | number, required | |
| `receiverId` | number, required | |
| `callStatus` | string, default 'initiated' | initiated, ringing, connected, ended, rejected, timeout |
| `offer` | object, nullable | WebRTC offer |
| `answer` | object, nullable | WebRTC answer |
| `iceCandidates` | array of { from, candidate } | |
| `ringingUsers` | [number] | |
| `connectedUsers` | [number] | |
| `createdAt` | Date | |
| `endedAt` | Date, nullable | |

Indexes: `callSessionId` (unique), `(callerId, callStatus)`, `(receiverId, callStatus)`, `callStatus`.

---

## 4. Storage Keys & Media Serving

- **Convention:** DB stores **keys** (paths), not full URLs. Keys are deterministic or UUID-based depending on module.
- **Allowed key prefixes** (for `GET /api/media/*`):  
  `profile/user/`, `profile/expert/`, `expert/`, `expert-photos/`, `expert-videos/`, `expert-documents/`.
- **Key builder helpers:**  
  `profile/user/{userId}/photo{1|2}.jpg`, `profile/expert/{userId}/photo{1|2}.jpg`, `expert/{userId}/intro.mp4`, `expert/{userId}/intro-thumb.jpg`.
- **Upload modules:**  
  - **Upload module** writes to local `expert-photos/`, `expert-videos/`, `expert-documents/` (UUID filenames); returns **public URLs** (e.g. `{API_PUBLIC_URL}/uploads/...`).  
  - **Media module** (profile photos) uses `StorageProvider`; returns **keys** and optionally built **urls**; files served via same `GET /api/media/<key>`.
- **Serving:** `GET /api/media/<key>` (or `/media/<key>` normalized) — no auth; key validated via `isAllowedKey`; Content-Type from extension (jpg, png, mp4, etc.).

---

## 5. REST API Reference

Base URL: `{BASE}/api`. All authenticated endpoints require header: `Authorization: Bearer <access_token>` unless stated.

### 5.1 Auth — `POST /api/auth/*`

| Method | Path | Auth | Request | Response / Notes |
|--------|------|------|--------|------------------|
| POST | `/auth/google` | No | `{ "idToken": string }` | `{ accessToken, refreshToken, expiresIn: 900, user: { id, name, email, role, expertStatus, profileCompleted } }` |
| POST | `/auth/refresh` | No | `{ "refreshToken": string }` | Same shape as google (new tokens + user) |
| POST | `/auth/profile/complete` | JWT | `CompleteProfileDto` (name, phone, role, gender?, dateOfBirth? \| date_of_birth?) | User entity (or 400/401) |

**CompleteProfileDto:** `name`, `phone` required; `role` enum (user | expert | admin); optional `gender`, `dateOfBirth` / `date_of_birth` (max 20 chars).

---

### 5.2 Users — `GET|POST /api/users/*`

| Method | Path | Auth | Request | Response / Notes |
|--------|------|------|--------|------------------|
| GET | `/users/me` | JWT | — | `UserMeDto`: `{ id, name, email, phone, role, expertStatus, profileCompleted }` |
| GET | `/users/me/profile-status` | JWT | — | `{ profileComplete: boolean, missingFields: string[] }` |
| POST | `/users/profile/complete` | JWT | Same as auth CompleteProfileDto | `UserMeDto` |
| POST | `/users/fcm-token` | JWT | Body: `token` (string) | `{ success: true }` or `{ success: false, message }` |

---

### 5.3 Experts — `GET|POST /api/experts/*`

| Method | Path | Auth | Request | Response / Notes |
|--------|------|------|--------|------------------|
| GET | `/experts/me/onboarding-status` | JWT | — | `ExpertOnboardingStatusDto`: `{ onboardingComplete, hasProfile?, hasPhotos?, hasIntroVideo?, hasDegreeCertificate?, hasAadhar? }` |
| POST | `/experts/profile` | JWT | `SubmitExpertProfileDto` | ExpertProfile entity |
| GET | `/experts/discover` | No | — | `{ experts: Array<DiscoverExpertItem> }` (approved only) |
| GET | `/experts/:id` | No | — | Single expert public profile (by user id) |

**SubmitExpertProfileDto:**  
`type` (ExpertType), `category` (ExpertCategory), `bio` (max 300), `languagesSpoken` (string[]), `photos` (string[], min 2), optional `introVideoUrl`, `introVideoCompressedUrl`, `degreeCertificateUrl`, `aadharUrl`. Validation: min 2 photos; intro video required (payload or existing upload); for professional, degree + aadhar required.

**DiscoverExpertItem:**  
`id`, `name`, `category`, `bio`, `languages`, `profile_photo_1_key`, `profile_photo_2_key`, `price_per_minute`, `rating`, `is_online`.

**Expert detail (GET :id):**  
Same plus `intro_video_url`, `intro_video_compressed_url`.

---

### 5.4 Call — `POST|GET /api/call/*`

All under JWT. 1-1 audio calls use **Agora** for media; backend creates session, writes to `call_logs`, sends **FCM** to callee for incoming call (app closed/background), and returns Agora token to caller/callee.

| Method | Path | Request | Response / Notes |
|--------|------|--------|------------------|
| POST | `/call/initiate` | `{ "receiverId": number }` | If busy: `{ ok: false, busy: true }`. Else: `{ ok, callSessionId, channelName, token, appId, uid }` — caller joins Agora; FCM sent to receiver. |
| POST | `/call/accept` | `{ "callSessionId": string }` | `{ ok, token, appId, channelName, uid }` — callee joins Agora. |
| POST | `/call/reject` | `{ "callSessionId": string }` | `{ ok }`. |
| POST | `/call/end` | `{ "callSessionId": string }` | `{ ok }` or `{ ok: false, message }`. |
| GET | `/call/logs` | Query: `limit?`, `offset?` | `{ logs: CallLog[] }` for current user. |

---

### 5.5 Chat — `GET|POST /api/chat/*`

All under JWT.

| Method | Path | Request | Response / Notes |
|--------|------|--------|------------------|
| GET | `/chat/messages/:peerId` | Query: `limit` (default 50), `offset` (default 0) | `{ data: Message[], total: number }` (messages with sender/receiver relations) |
| POST | `/chat/messages/:peerId/read` | — | `{ success: true }` |
| GET | `/chat/list` | — | Array of `{ peerId, peerName, peerPhoto (key), latestMessage, time (ISO), unreadCount }` |

---

### 5.6 Upload — `POST /api/upload/*`

JWT required. Multipart/form-data.

| Method | Path | Field(s) | Limits | Response |
|--------|------|----------|--------|----------|
| POST | `/upload/expert/photos` | `photos` (2–5 files) | 10 MB each; JPEG/PNG/GIF/WebP | `{ urls: string[] }` (public URLs) |
| POST | `/upload/expert/video` | `video` (1 file) | 15 MB; MP4/WebM | `{ url: string }` |
| POST | `/upload/expert/document` | `document` (1 file) | 10 MB; image or PDF | `{ url: string }` |

---

### 5.7 Media — `GET|POST /api/media/*`

| Method | Path | Auth | Request | Response / Notes |
|--------|------|------|--------|------------------|
| POST | `/media/profile/upload` | JWT | multipart `photos` (max 2) | `{ keys, urls }` (profile photo keys and public URLs) |
| GET | `/media/*` | No | Path = key (e.g. after `/api/media/` or `/media/`) | Binary file; 404 if not found; Content-Type by extension |

---

### 5.8 Expert Video (app upload) — `POST /api/expert/video/*`

| Method | Path | Auth | Request | Response |
|--------|------|------|--------|----------|
| POST | `/expert/video/upload` | JWT | multipart `video`; body `duration?` (0–10) | `{ id, videoKey, ... }` (ExpertVideo); status = pending until admin approval |

---

### 5.9 Agora — `POST /api/agora/*`

JWT required.

| Method | Path | Request | Response |
|--------|------|--------|----------|
| POST | `/agora/rtc-token` | `{ channelName: string, userId: number, role: 'publisher' \| 'subscriber', expireSeconds?: number }` (min 60) | `{ token, appId, channelName, uid, expireAt }` |

---

### 5.10 Admin — `GET|POST /api/admin/*`

Admin JWT (separate strategy/guard); role guard: `AdminOnly()` or `AdminOrSeller()`.

| Method | Path | Auth | Request | Response / Notes |
|--------|------|------|--------|------------------|
| POST | `/admin/auth/login` | No | `{ email, password }` | Admin token + user info |
| GET | `/admin/experts` | JWT + AdminOnly | — | List expert requests |
| POST | `/admin/experts/:id/approve` | JWT + AdminOnly | — | — |
| POST | `/admin/experts/:id/reject` | JWT + AdminOnly | — | — |
| GET | `/admin/expert/videos/pending` | JWT + AdminOnly | — | Pending expert intro videos |
| POST | `/admin/expert/video/approve/:id` | JWT + AdminOnly | — | — |
| POST | `/admin/expert/video/reject/:id` | JWT + AdminOnly | — | — |
| GET | `/admin/sellers` | JWT + AdminOnly | — | List sellers |
| POST | `/admin/sellers` | JWT + AdminOnly | `{ name, email, password }` (password min 8) | Create seller |
| GET | `/admin/call-logs` | JWT + AdminOnly | Query: `limit?`, `offset?`, `from?`, `to?`, `callerId?`, `receiverId?` | `{ logs: CallLog[] }` for analytics. |

---

### 5.11 Health (optional)

When HealthModule is enabled: `GET /api/health` → `{ status: 'ok' | 'degraded', postgres, mongo, redis }` (each 'ok' or 'down').

---

## 6. WebSocket API

**Base URL:** Same origin; Socket.IO client must connect to namespaces with correct path (e.g. `/call`, `/chat`). **Authentication:**  
- **Call:** `handshake.auth.token` or `Authorization: Bearer <access_token>` (JWT).  
- **Chat:** JWT via same mechanisms; after connect, emit `register` (with JwtWsGuard) to map socket to user.

### 6.1 Namespace: `/call`

- **Auth:** Required at connection (JWT in auth or headers); `client.data.userId` set after verify.
- **Events (client → server):**

| Event | Payload | Description |
|-------|---------|-------------|
| `call:initiate` | `{ receiverId: number }` | Start call; server creates session, sets ringing, emits to receiver; 30s ring timeout → `call:timeout` |
| `call:accept` | `{ callSessionId: string }` | Callee accepts; server sets connected, notifies caller |
| `call:reject` | `{ callSessionId: string }` | Callee rejects |
| `call:end` | `{ callSessionId: string }` | Either party ends; server updates call log, duration |
| `call:offer` | `{ callSessionId, offer }` | WebRTC offer relay to peer |
| `call:answer` | `{ callSessionId, answer }` | WebRTC answer relay to peer |
| `call:ice-candidate` | `{ callSessionId, candidate }` | ICE candidate relay to peer |

- **Events (server → client):**

| Event | Payload | Description |
|-------|---------|-------------|
| `call:ringing` | `{ callSessionId, callerId }` | Incoming call / call state ringing |
| `call:busy` | `{ receiverId }` | Receiver already in call |
| `call:accept` | `{ callSessionId, acceptedBy }` | Call accepted |
| `call:reject` | `{ callSessionId, rejectedBy }` | Call rejected |
| `call:end` | `{ callSessionId }` | Call ended |
| `call:timeout` | `{ callSessionId }` | Ring timeout |
| `call:offer` | `{ callSessionId, offer }` | WebRTC offer from peer |
| `call:answer` | `{ callSessionId, answer }` | WebRTC answer from peer |
| `call:ice-candidate` | `{ callSessionId, candidate, from }` | ICE candidate from peer |

### 6.2 Namespace: `/chat`

- **Auth:** Guard on messages; `register` maps socket to user id (stored in `userSockets`).
- **Events (client → server):**

| Event | Payload | Description |
|-------|---------|-------------|
| `register` | (any, after JWT verified) | Registers socket for user; response `{ event: 'registered', data: { success: true } }` |
| `sendMessage` | `{ receiverId: number, content: string }` | Persists message, FCM to receiver if offline; emits `messageSent` to sender, `newMessage` to receiver if online |
| `markRead` | `{ peerId: number }` | Mark messages from peer as read; notifies peer via `messagesRead` |
| `markDelivered` | `{ peerId: number }` | Mark messages from peer as delivered; notifies peer via `messagesDelivered` |

- **Events (server → client):**

| Event | Payload | Description |
|-------|---------|-------------|
| `messageSent` | Message entity | Ack for sent message |
| `newMessage` | Message entity | Incoming message (receiver online) |
| `messagesRead` | `{ peerId }` | Peer read messages |
| `messagesDelivered` | `{ peerId }` | Peer marked delivered |
| `error` | string | e.g. Unauthorized or internal error |

---

## 7. Approach Summary

- **Single global prefix:** All REST under `/api`; Swagger at `/api/docs`.
- **Validation:** DTOs with class-validator; ValidationPipe strips unknown properties and can forbid non-whitelisted.
- **Auth:** JWT access (short-lived) + refresh (stored hashed); Google login via ID token; optional FCM for push.
- **Profile & expert gating:** App uses `GET /users/me` and `GET /users/me/profile-status` for profile completion; experts use `GET /experts/me/onboarding-status` for step 3; backend is source of truth.
- **Media:** Keys in DB; public read via `GET /api/media/<key>`; upload flows return keys or public URLs depending on module.
- **Calls:** REST for availability and log; signaling and WebRTC relay on `/call` namespace; Agora RTC tokens for actual audio.
- **Chat:** REST for history and list; real-time send/read/delivered via `/chat` namespace; FCM when receiver offline.
- **Admin:** Separate JWT strategy and role metadata (`adminRoles`); guards enforce admin/seller for sensitive routes.

This document is the single technical reference for schemas, APIs, and approach for the HeyyPal backend.
