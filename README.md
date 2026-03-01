# HeyyPal Backend Monorepo

Monorepo for **docker**, **backend** (Express + PostgreSQL + MongoDB), and **admin_panel** (Next.js).

## Structure

- **`docker/`** – Nginx config, PostgreSQL schema init (`docker/init/01-schema.sql`)
- **`backend/`** – Express API (auth, admin, profiles), PostgreSQL + MongoDB
- **`admin_panel/`** – Next.js admin UI (login, experts, sellers)

## Quick start (Docker)

```bash
cp .env.docker.example .env
# Edit .env: set JWT_SECRET, GOOGLE_CLIENT_ID, NEXT_PUBLIC_API_URL if needed
docker compose up -d --build
```

- **API**: http://localhost/api  
- **Admin panel**: http://localhost  
- **PostgreSQL**: port 5432 (user/db: heyypal)  
- **MongoDB**: port 27017  

Default admin (created on first start): `admin@heyypal.com` / `Admin123!`

## Local dev

- **Backend**: `cd backend && npm install && npm run dev` (requires PostgreSQL)
- **Admin panel**: `cd admin_panel && npm install && npm run dev`
- See `backend/README-AUTH.md` for API and DB details.
