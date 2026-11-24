# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS builder

WORKDIR /src

RUN apk add --no-cache git

COPY api/go.mod api/go.sum ./
RUN go mod download

COPY api/ ./

RUN CGO_ENABLED=0 go build -o /bin/dumb-pipe-api ./cmd/server/main.go

FROM alpine:latest

RUN apk add --no-cache ca-certificates wget

WORKDIR /app

COPY --from=builder /bin/dumb-pipe-api /bin/dumb-pipe-api

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

ENTRYPOINT ["/bin/dumb-pipe-api"]
