# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS builder

WORKDIR /src

# Install build dependencies
RUN apk add --no-cache git

# Download Go modules
COPY api/go.mod api/go.sum ./
RUN go mod download

# Copy source and build
COPY api/ ./
RUN CGO_ENABLED=0 go build -o /bin/dumb-pipe-api ./main.go

# --- Runtime ---
FROM alpine:latest

WORKDIR /app

# Copy binary
COPY --from=builder /bin/dumb-pipe-api /bin/dumb-pipe-api

# Expose API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/sessions || exit 1

ENTRYPOINT ["/bin/dumb-pipe-api"]
