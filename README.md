# DumbPipe

A lightweight, self-hosted session replay platform.

DumbPipe captures frontend user sessions, compresses them natively in the browser, and uploads them in 10-second chunks directly to S3-compatible storage. The Go backend stores *only* metadata in PostgreSQL—never the heavy replay payloads. 

No ClickHouse. No Kafka. No Redis. Just a highly efficient, "dumb" pipe.

## 🚀 Quick Start

1. **Start Infrastructure**
   ```bash
   docker compose up -d postgres minio
   ```

2. **Apply Migrations**
   ```bash
   psql "postgres://postgres:postgres@localhost:5432/dumbpipe?sslmode=disable" \
     -f api/migrations/001_initial.sql
   ```

3. **Install & Run**
   ```bash
   pnpm install
   pnpm run dev # Starts Go API and React UI concurrently
   ```

4. **View**
   - UI: `http://localhost:5173`
   - API: `http://localhost:8080`

## 📚 Documentation

- **[Architecture & Design](./ARCHITECTURE.md)**: Deep dive into the data flow, API contracts, and deployment strategies.
- **[SDK Usage](./ARCHITECTURE.md#frontend-sdk-usage)**: How to integrate the recorder into your app.

## 🛠️ Tech Stack

- **Backend**: Go 1.27, chi, pgx
- **Frontend**: TypeScript, React 18, Vite, native `CompressionStream`
- **Storage**: PostgreSQL (metadata), MinIO/Supabase (compressed chunks)
- **Package Manager**: pnpm 12

---
*See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete system design.*