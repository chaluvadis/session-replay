# DumbPipe: Zero-Infrastructure Session Replay

**Commercial session replay tools force you to manage ClickHouse and Kafka. DumbPipe uses native browser streaming compression and S3 presigned URLs to give you enterprise-grade replay with zero heavy infrastructure.**

---

## 🏆 Hackathon Pitch

DumbPipe is a lightweight, self-hosted session replay platform built for speed, simplicity, and zero operational overhead. No ClickHouse. No Kafka. No Redis. Just a tiny Go API, native browser `CompressionStream` API, and S3-compatible object storage.

### Sponsor Shoutouts

**Powered by Supabase:** Using Supabase Storage's S3-compatible API for zero-backend file transfers. Chunks are uploaded directly from the browser to Supabase via presigned URLs—your backend never touches the payload.

**Deployed on Fly.io:** Running our lightweight Go API in the Mumbai region (`bom`) for sub-50ms edge latency. A single shared-CPU VM with 256MB RAM is all you need.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (End User)                          │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │   rrweb     │  │ StreamingCompressor│  │   Fetch API (PUT)   │   │
│  │  (record)   │  │  (gzip NDJSON)    │  │   presigned URL     │   │
│  └──────┬──────┘  └────────┬─────────┘  └──────────┬──────────┘   │
│         │                  │                       │               │
│         │  10s chunks      │  gzip-compressed      │   S3 PUT      │
│         ▼                  ▼                       ▼               │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Go API (chi + pgx)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  /api/sessions│→│  PostgreSQL  │  │  /api/chunks (PUT/GET) │→ │ Supabase Storage
│  │  metadata     │  │   (metadata) │  │   presigned URLs     │    │  (chunks, gzip NDJSON)
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      React Replay UI (rrweb-player)                 │
│  Fetch presigned GET URLs → DecompressionStream(gzip) → NDJSON      │
│  → sort by timestamp → rrweb-player                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22, chi router, pgx (PostgreSQL), minio-go |
| Frontend SDK | TypeScript, native CompressionStream API, rrweb |
| Replay UI | React 19, rrweb-player, Vite |
| Storage | Supabase Storage (S3-compatible), PostgreSQL (metadata only) |
| Package Manager | pnpm |
| Compression | Native gzip via CompressionStream / DecompressionStream |
| Chunking | 10-second interval, gzip-compressed NDJSON |
| Deploy | Fly.io (API) + GitHub Pages (UI) |

### Core Constraints

- **No ClickHouse, no Kafka, no Redis.** Intentionally lightweight.
- All JSON uses camelCase.
- Errors use format: `{ "error": { "code": "...", "message": "..." } }`
- MinIO objects are gzip-compressed NDJSON.
- Object key format: `{session_id}/{chunk_index:06d}.gz`
- No authentication (prototype).
- `sessions` table includes `run_id UUID` for future multi-agent support.

---

## 🚀 Quickstart

### Option 1: Docker Compose (full stack)

```bash
# Clone the repo
git clone <repository>
cd dumb-pipe

# Start PostgreSQL + MinIO + API
docker compose up -d

# Apply database migration
psql "postgres://postgres:postgres@localhost:5432/dumbpipe?sslmode=disable" \
  -f api/migrations/001_initial.sql

# Install frontend dependencies
pnpm install

# Run the UI in dev mode
pnpm dev
```

The UI will be available at `http://localhost:5173` and the API at `http://localhost:8080`.

### Option 2: Manual (backend only)

```bash
cd api
go run ./cmd/server/main.go
```

Then in another terminal:

```bash
pnpm install
pnpm dev
```

---

## 📦 Usage

### Recording (Frontend SDK)

```ts
import DumbPipeSDK from "@dumb-pipe/sdk";

const sdk = new DumbPipeSDK({ baseUrl: "http://localhost:8080" });

await sdk.start(); // starts rrweb recording, 10s chunked uploads

// ... user interacts with the app ...

await sdk.complete(); // flush remaining events, mark session complete
```

### Replay UI

1. Open `http://localhost:5173`
2. Browse recorded sessions in the session list
3. Click any session to replay it with full rrweb-player controls (play, pause, seek, timeline)

---

## 📡 API Contract

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

---

## 🛠️ Commands

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

await sdk.start();

// ... user interacts ...

await sdk.complete();
```

---

## ☁️ Deployment

### API (Fly.io)

```bash
flyctl deploy
```

Configured in `api/fly.toml`:
- Region: `bom` (Mumbai)
- VM: shared-cpu-1x, 256MB RAM
- Internal port: 8080

### UI (GitHub Pages)

Built and deployed automatically via GitHub Actions on push to `main`. Configured in `.github/workflows/deploy.yml`.

---

## 📄 License

MIT
