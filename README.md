# DumbPipe

A lightweight, self-hosted session replay platform.

DumbPipe captures frontend user sessions using rrweb, compresses them with the native browser `CompressionStream` API, and uploads them in 10-second gzip chunks to S3-compatible object storage via presigned URLs. The Go backend stores only session metadata in PostgreSQL—never the replay payload itself.

## Architecture

```
Browser SDK              Go API (chi + pgx)          Object Storage
─────────────            ─────────────────           ──────────────
rrweb.record()           POST /api/sessions          MinIO buckets
CompressionStream (gzip)  POST /api/chunks            {session_id}/
10s chunks, NDJSON        GET /api/sessions           {chunk_index:06d}.gz
                         GET /api/sessions/:id/chunks
                         presigned PUT/GET URLs

Browser (replay UI)       ←──  GET presigned URLs
──────────────            DecompressionStream (gzip)
rrweb-player              NDJSON parse → timestamp sort
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22, chi router, pgx (PostgreSQL), minio-go |
| Frontend SDK | TypeScript, native CompressionStream API, rrweb |
| Replay UI | React 19, rrweb-player, Vite |
| Storage | MinIO (compressed chunks), PostgreSQL (metadata only) |
| Package Manager | pnpm |
| Compression | Native gzip via CompressionStream / DecompressionStream |
| Chunking | 10-second interval, gzip-compressed NDJSON |
| Deploy | Docker, Fly.io, GitHub Pages |

### Core Constraints

- No ClickHouse, no Kafka, no Redis. Intentionally lightweight.
- All JSON uses camelCase.
- Errors use format: `{ "error": { "code": "...", "message": "..." } }`
- MinIO objects are gzip-compressed NDJSON.
- Object key format: `{session_id}/{chunk_index:06d}.gz`
- No authentication (prototype).
- `sessions` table includes `run_id UUID` for future multi-agent support.

## Repository Structure

```
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
├── .github/workflows/ci.yml
├── .github/workflows/deploy.yml
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json     # pnpm workspace root
└── pnpm-workspace.yaml
```

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Go | 1.22 |
| Node.js | 20 (LTS) |
| pnpm | 8 |
| Docker | 20.10+ |

## Local Development

### 1. Clone and install

```bash
git clone <repository>
cd dumb-pipe
```

### 2. Start infrastructure (PostgreSQL + MinIO)

```bash
docker compose up -d postgres minio
```

### 3. Apply database migration

```bash
psql "postgres://postgres:postgres@localhost:5432/dumbpipe?sslmode=disable" \
  -f api/migrations/001_initial.sql
```

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env as needed
```

### 5. Install frontend dependencies

```bash
pnpm install
```

### 6. Run the backend

```bash
cd api
go run ./cmd/server/main.go
```

### 7. Run the frontend (dev mode)

```bash
pnpm dev
```

The UI will be available at `http://localhost:5173` and the API at `http://localhost:8080`.

## API Contract

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | POST | Register a new session (returns 201) |
| `/api/chunks` | POST | Get presigned MinIO PUT URL for a chunk |
| `/api/sessions/:id/complete` | POST | Mark a session complete |
| `/api/sessions` | GET | List all sessions |
| `/api/sessions/:id/chunks` | GET | Get presigned GET URLs for chunk playback |

### Error Response Format

```json
{ "error": { "code": "...", "message": "..." } }
```

## Commands

### Root (pnpm workspace)

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm run build` | Build all packages (types, sdk, ui) |
| `pnpm run dev` | Start the UI dev server |
| `pnpm run typecheck` | TypeScript typecheck all packages |
| `pnpm run lint` | ESLint the UI package |
| `pnpm run test` | Run UI tests (vitest) |

### Backend (Go)

| Command | Description |
|---------|-------------|
| `cd api && go build ./...` | Build the Go backend |
| `cd api && go test ./...` | Run Go tests |
| `cd api && go vet ./...` | Go vet |
| `cd api && go fmt ./...` | Go fmt |
| `cd api && go mod tidy` | Tidy Go modules |

### Frontend SDK (`@dumb-pipe/sdk`)

```ts
import DumbPipeSDK from "@dumb-pipe/sdk";

const sdk = new DumbPipeSDK({ baseUrl: "http://localhost:8080" });

await sdk.start(); // starts rrweb recording, 10s chunked uploads

// ... user interacts with the app ...

await sdk.complete(); // flush remaining events, mark session complete
```

## Docker

### Backend only

```bash
docker build -t dumb-pipe-api -f api/Dockerfile .
```

### Full stack (PostgreSQL + MinIO + API)

```bash
docker compose up --build
```

## CI/CD

- `.github/workflows/ci.yml` — runs on every push and PR: backend (go mod tidy, fmt, vet, build, test), frontend (typecheck, lint, build, test), and integration (starts backend + infrastructure, verifies build output).
- `.github/workflows/deploy.yml` — deploys the UI to GitHub Pages on push to `main`.

## Deployment

### API (Fly.io)

```bash
flyctl deploy
```

Configured in `api/fly.toml`:
- Region: `bom` (Mumbai)
- VM: shared-cpu-1x, 256MB RAM
- Internal port: 8080

Set `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` as Fly secrets:

```bash
fly secrets set MINIO_ACCESS_KEY=<key> MINIO_SECRET_KEY=<secret>
```

### UI (GitHub Pages)

Built and deployed automatically via GitHub Actions on push to `main`. Configured in `.github/workflows/deploy.yml`.

## License

MIT