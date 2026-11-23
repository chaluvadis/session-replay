# syntax=docker/dockerfile:1
FROM node:26-alpine AS builder

WORKDIR /src

# Install pnpm via corepack
RUN corepack enable

# Install workspace dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/types/src ./packages/types/src
COPY packages/types/tsconfig.json ./packages/types/
COPY packages/sdk/src ./packages/sdk/src
COPY packages/sdk/tsconfig.json ./packages/sdk/
COPY packages/ui/src ./packages/ui/src
COPY packages/ui/index.html ./packages/ui/
COPY packages/ui/vite.config.ts ./packages/ui/
COPY packages/ui/tsconfig.json ./packages/ui/

# Build all packages
RUN pnpm run build

# --- Runtime ---
FROM nginx:1.27-alpine

COPY --from=builder /src/packages/ui/dist /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["nginx", "-g", "daemon off;"]
