# HeyyPal Auth & Roles

## Overview

- **App users**: Google login only. No email/password. First-time flow → Complete Profile (name, phone, role). Role: **User** (full access) or **Expert** (full access only after admin approval).
- **Admin panel**: Manual login (email + password). Roles: **Admin** (full), **Seller** (limited). Sellers are created by Admin only.

## Backend API

### App auth (`/api/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/google` | Body: `{ "idToken": "<Google ID token>" }`. Returns `accessToken`, `refreshToken`, `user`. |
| POST | `/api/auth/refresh` | Body: `{ "refreshToken": "..." }`. Returns new `accessToken`. |
| GET | `/api/auth/me` | Requires `Authorization: Bearer <accessToken>`. Returns current user. |
| POST | `/api/auth/profile/complete` | Body: `{ "name", "phone", "role": "user" \| "expert" }`. Requires auth. Returns updated user + new accessToken. |

### Admin (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/auth/login` | — | Body: `{ "email", "password" }`. Returns `accessToken`, `user`. |
| GET | `/api/admin/experts` | Admin | List all experts (pending/approved/rejected). |
| POST | `/api/admin/experts/:id/approve` | Admin | Set expert_status = approved. |
| POST | `/api/admin/experts/:id/reject` | Admin | Set expert_status = rejected. |
| GET | `/api/admin/sellers` | Admin | List sellers. |
| POST | `/api/admin/sellers` | Admin | Body: `{ "name", "email", "password" }`. Create seller. |

### JWT payload (app)

- `sub`: user id  
- `type`: `"app"`  
- `role`: `"user"` \| `"expert"`  
- `expert_status`: `"pending"` \| `"approved"` \| `"rejected"` \| null  
- `profile_completed`: 0 \| 1  

Use **isExpertApproved** middleware for routes that require approved experts.

## Databases

- **PostgreSQL**: Auth and relational data (`users`, `admin_users`, `refresh_tokens`). Schema: `backend/src/db/schema.sql`. Docker init scripts in `docker/init/01-schema.sql` run on first start.
- **MongoDB**: Optional; use for audit logs, sessions, or app-specific collections. Connection via `getMongoDb()` from `backend/src/db/config.js`.

## PostgreSQL schema and admin seed

**The backend applies the schema and seeds a default admin on its own when it starts.** No need to run schema or seed scripts manually if PostgreSQL is reachable.

- On first start it creates tables and indexes, then ensures at least one admin exists (default: `admin@heyypal.com` / `Admin123!`). Override with `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_NAME`.
- To run schema or seed yourself (e.g. for a one-off DB): use `backend/src/db/schema.sql` with `psql`, or `npx tsx scripts/seed-admin.ts`.

## Android flow (Google login)

1. User signs in with Google (Firebase Auth or Google Identity Services).
2. Get ID token and send to `POST /api/auth/google` with `{ "idToken": "..." }`.
3. If `user.profile_completed === false`, show **Complete Profile** screen (name, phone, role). Then `POST /api/auth/profile/complete`.
4. Store `accessToken` (and optionally `refreshToken`). Use `Authorization: Bearer <accessToken>` for API calls.
5. If role is **expert** and `expert_status !== 'approved'`, treat as normal user until admin approves.

## Docker

From repo root:

```bash
cp .env.docker.example .env
# Edit .env: set JWT_SECRET, GOOGLE_CLIENT_ID, NEXT_PUBLIC_API_URL if needed
docker compose up -d
```

- **PostgreSQL**: port 5432 (user/db: heyypal). **MongoDB**: port 27017.
- **API**: http://localhost/api  
- **Admin panel**: http://localhost  

Seed admin after first run (e.g. run seed script with `PG_HOST=localhost` and port 5432 exposed, or exec into backend container and run seed with `PG_HOST=postgres`).
