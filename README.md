# Dumb Pipe

A lightweight, self-hosted session replay platform.

## Architecture

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.27, chi router, pgx (PostgreSQL), minio-go (MinIO) |
| Frontend SDK | TypeScript, native CompressionStream API, rrweb |
| Replay UI | React 19, rrweb-player, Vite |
| Storage | MinIO (compressed chunks), PostgreSQL (metadata only) |
| Package Manager | pnpm |
| Compression | Native gzip via CompressionStream/DecompressionStream |
| Chunking | 10-second interval, gzip-compressed NDJSON |

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
│   ├── go.mod
│   ├── Dockerfile
│   ├── main.go
│   ├── internal/
│   └── migrations/
├── .github/workflows/ci.yml
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json     # pnpm workspace root
└── pnpm-workspace.yaml
```

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Go | 1.27 |
| Node.js | 20 (LTS) |
| pnpm | 8 |

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
go run ./main.go
```

### 7. Run the frontend (dev mode)

```bash
pnpm dev
```

The UI will be available at `http://localhost:5173` and proxies `/api` to `http://localhost:8080`.

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
| `pnpm run format` | Prettier format the UI package |
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

### Full stack (PostgreSQL + MinIO + API + UI)

```bash
docker compose up --build
```

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push and PR:
- Backend: go mod tidy check, go fmt, go vet, go build, go test
- Frontend: pnpm install, typecheck, lint, build, test
- Integration: starts backend + infrastructure, verifies build output

## License

MIT
