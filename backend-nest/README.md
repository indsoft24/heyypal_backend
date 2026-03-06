# HeyyPal API v2 (NestJS)

Backend architecture: **NestJS** (TypeScript), **REST**, API Gateway pattern, with:

- **PostgreSQL** – core business data (users, roles, profiles)
- **MongoDB** – logs, audit trail, dynamic/unstructured config
- **Redis** – caching, session/refresh token store
- **RabbitMQ** – event-driven messaging
- **PII encryption** – sensitive fields (e.g. phone, chat) encrypted at rest (AES-256-GCM)
- **JWT** with refresh tokens, **role-based access** (RBAC)
- **Logging** and **auditing** (MongoDB)
- **File storage** – abstract layer (local/S3/GCS)

## Quick start

**1. Start databases (required for local dev)**

From the **repo root** (not `backend-nest`):

```bash
docker compose -f docker-compose.dev-deps.yml up -d
```

This starts PostgreSQL (5432), MongoDB (27017), Redis (6379), and RabbitMQ (5672, management UI 15672).

**2. Run the API**

```bash
cd backend-nest
cp .env.example .env
# Optional: edit .env (JWT_SECRET, GOOGLE_CLIENT_ID, PII_ENCRYPTION_KEY, AGORA_*, FIREBASE_*)
npm install
npm run start:dev
```

API: `http://localhost:5001/api`

**Calls (Agora):** For 1-1 audio calling, set in `.env` (and on **production server**):

- `AGORA_APP_ID` – from [Agora Console](https://console.agora.io/) → Project → App ID  
- `AGORA_APP_CERTIFICATE` – same project → Primary Certificate  

If these are missing, `POST /api/call/initiate` returns 500. On the deployed host (e.g. 187.77.191.120), ensure the process has these env vars (e.g. in systemd `Environment=`, Docker `env`, or a `.env` file in the app working directory).  
Swagger: `http://localhost:5001/api/docs`

If you see **"Unable to connect to the database"**, ensure the dev-deps containers are running (`docker compose -f docker-compose.dev-deps.yml ps`).

## Docker (horizontal scaling)

From repo root:

```bash
docker compose -f docker-compose.nest.yml up -d --build
# Scale API instances:
docker compose -f docker-compose.nest.yml up -d --scale api=2
```

- **Gateway**: nginx on port 80 → load-balances to `api`
- **API**: NestJS on 5001 (multiple replicas when scaled)
- **PostgreSQL**: 5432, **MongoDB**: 27017, **Redis**: 6379, **RabbitMQ**: 5672 (management: 15672)

## CI/CD

`.github/workflows/ci.yml` runs on push/PR to `main`/`develop`:

1. **Lint & test** – install, lint, build, test in `backend-nest`
2. **Build Docker** – build API image (no push)
3. **Deploy** – only on push to `main`; add your steps (push to registry, deploy to K8s/ECS)

## Project structure

```
src/
├── core/                 # Shared infrastructure
│   ├── redis/            # Redis caching
│   ├── encryption/       # PII encryption (AES-256-GCM)
│   ├── rabbitmq/         # Event publishing
│   ├── logging/          # Logs → MongoDB
│   ├── audit/            # Audit trail → MongoDB
│   └── storage/          # File/static storage abstraction
├── modules/
│   ├── auth/             # JWT, refresh token, Google login
│   ├── users/             # User CRUD, profile (encrypted PII)
│   └── health/            # Health check (PG, Mongo, Redis)
├── app.module.ts
└── main.ts
```

## RBAC

Use `@Roles(UserRole.ADMIN)` and `RolesGuard` with `JwtAuthGuard` on routes that require specific roles.

## Events (RabbitMQ)

Inject `RabbitMQService` and publish:

```ts
await this.rabbitMQ.publish('heyypal.events', 'user.registered', { userId, email });
```

Consumers can be added in the same app or as separate services.
