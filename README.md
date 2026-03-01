# HeyyPal Backend Monorepo

Monorepo for **docker**, **backend-nest** (NestJS + PostgreSQL + MongoDB + Redis + RabbitMQ), and **admin_panel** (Next.js).

## Structure

- **`docker/`** – Nginx config, PostgreSQL schema init (`docker/init/01-schema.sql`)
- **`backend-nest/`** – NestJS API (auth, users, TypeORM, Mongoose, Redis, RabbitMQ)
- **`admin_panel/`** – Next.js admin UI (login, experts, sellers)

## Quick start (Docker)

```bash
cp .env.docker.example .env
# Edit .env: set JWT_SECRET, GOOGLE_CLIENT_ID, NEXT_PUBLIC_API_URL if needed
docker compose up -d --build
```

- **API**: http://localhost:8080/api  
- **Admin panel**: http://localhost:8080 or http://localhost:3000  
- **PostgreSQL**: 5432 | **MongoDB**: 27017 | **Redis**: 6379 | **RabbitMQ**: 5672 (management: 15672)  

Default admin: `admin@heyypal.com` / `Admin123!` (if seeded by Nest backend)

## Deploy on VPS (nginx on 8080)

1. **Set the public API URL** in `.env`:
   ```bash
   NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP:8080
   ```
   Example: `NEXT_PUBLIC_API_URL=http://187.77.191.120:8080`

2. **Rebuild and start**:
   ```bash
   docker compose up -d --build
   ```
   Or rebuild only the admin panel after changing the URL:
   ```bash
   docker compose up -d --build admin_panel
   ```

3. **Use the app**
   - Admin panel (direct): `http://YOUR_VPS_IP:3000`
   - Admin + API via nginx: `http://YOUR_VPS_IP:8080`  
   Login: `admin@heyypal.com` / `Admin123!`

If you see “Cannot reach API at … Failed to fetch”, set `NEXT_PUBLIC_API_URL` to your VPS IP (or domain) and port 8080, then rebuild the admin_panel image.

The admin panel also uses a **runtime fallback**: when opened from a non-localhost host (e.g. your VPS IP), it calls the API at `http://<same-host>:8080`. After one deploy/rebuild, login works on the VPS without setting `NEXT_PUBLIC_API_URL`.

## Local dev

- **Backend (Nest)**: `cd backend-nest && npm install && npm run start:dev` (requires PostgreSQL, MongoDB, Redis, RabbitMQ)
- **Admin panel**: `cd admin_panel && npm install && npm run dev`
- Optional: `docker compose -f docker-compose.dev-deps.yml up -d` for Postgres, Mongo, Redis, RabbitMQ only.
