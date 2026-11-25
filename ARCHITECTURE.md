# DumbPipe Architecture

This document details the design, constraints, and data flow of the DumbPipe session replay platform.

## 🏗️ The "Dumb Pipe" Philosophy

Commercial session replay tools force you to manage heavy infrastructure (ClickHouse, Kafka, Redis). DumbPipe avoids this by acting as a "dumb pipe":
1. The browser handles compression natively via `CompressionStream`.
2. Compressed data is uploaded directly to object storage via presigned URLs.
3. The Go backend *only* manages metadata and URL generation, keeping memory and compute footprints tiny.

## 🔄 Data Flow

```text
Browser SDK              Go API (chi + pgx)          Object Storage
─────────────            ─────────────────           ──────────────
rrweb.record()           POST /api/sessions          MinIO / Supabase
CompressionStream (gzip)  POST /api/chunks            {session_id}/
10s chunks, NDJSON        GET /api/sessions           {chunk_index:06d}.gz
                         GET /api/sessions/:id/chunks
                         (Returns presigned URLs)

Browser (Replay UI)      ←──  GET presigned URLs
──────────────            DecompressionStream (gzip)
rrweb-player              NDJSON parse → timestamp sort
```

## 🧱 Core Constraints

- **No Heavy Infra**: No ClickHouse, Kafka, or Redis.
- **Data Format**: All JSON uses `camelCase`. MinIO objects are gzip-compressed NDJSON.
- **Object Keys**: Strictly formatted as `{session_id}/{chunk_index:06d}.gz`.
- **Error Format**: Standardized as `{ "error": { "code": "...", "message": "..." } }`.
- **Future-Proofing**: The `sessions` table includes a `run_id UUID` column to support future multi-agent workflow tracing.

## 📂 Repository Structure

```text
dumb-pipe/
├── packages/
│   ├── types/       # Shared TypeScript interfaces (@dumb-pipe/types)
│   ├── sdk/         # Frontend recorder SDK (@dumb-pipe/sdk)
│   └── ui/          # React replay UI (@dumb-pipe/ui)
├── api/             # Go backend (independent of pnpm workspace)
│   ├── cmd/server/main.go
│   ├── internal/
│   ├── migrations/
│   ├── Dockerfile
│   └── go.mod
├── .github/workflows/
│   ├── ci.yml       # Build, test, and integration checks
│   └── deploy.yml   # GitHub Pages deployment
├── docker-compose.yml
├── .env.example
└── pnpm-workspace.yaml
```

## 🔌 API Contract

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | POST | Register a new session (returns `201 Created`) |
| `/api/chunks` | POST | Get presigned PUT URL for a chunk |
| `/api/sessions/:id/complete` | POST | Mark a session as complete |
| `/api/sessions` | GET | List all sessions (supports query filtering) |
| `/api/sessions/:id/chunks` | GET | Get presigned GET URLs for chunk playback |

## 🚀 Deployment

### Backend (Fly.io)
Deployed via `flyctl deploy`. 
- **Region**: `bom` (Mumbai) for low latency.
- **Resources**: `shared-cpu-1x`, 256MB RAM.
- **Secrets**: `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `DATABASE_URL`.

### Frontend (GitHub Pages)
Automatically built and deployed via GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`.

### Storage (Supabase / MinIO)
- **Local**: MinIO via `docker-compose.yml`.
- **Production**: Supabase Storage (S3-compatible API). Ensure `MINIO_ENDPOINT` includes the `/storage/v1/s3` suffix.

## 💻 Frontend SDK Usage

```typescript
import { initSessionReplay } from "@dumb-pipe/sdk";

const recorder = initSessionReplay({
  apiEndpoint: "https://dumbpipe-api.fly.dev",
  application: "my-web-app",
  environment: "production",
  sampleRate: 0.1, // Record 10% of sessions
});
```