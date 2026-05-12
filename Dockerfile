# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM node:24-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/messaging-app/package.json ./artifacts/messaging-app/

RUN pnpm install --frozen-lockfile

# ============================================================
# Stage 2: Build the API server
# ============================================================
FROM deps AS build-api
WORKDIR /app

COPY lib/ ./lib/
COPY tsconfig.json ./
COPY tsconfig.base.json ./
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm --filter @workspace/api-server run build

# ============================================================
# Stage 3: Build the frontend
# ============================================================
FROM deps AS build-frontend
WORKDIR /app

COPY lib/ ./lib/
COPY tsconfig.json ./
COPY tsconfig.base.json ./
COPY artifacts/messaging-app/ ./artifacts/messaging-app/

RUN pnpm --filter @workspace/messaging-app run build

# ============================================================
# Stage 4: Production runtime — Node + Python + FFmpeg + yt-dlp
# ============================================================
FROM node:24-alpine AS runtime
WORKDIR /app

# System tools: FFmpeg + Python + yt-dlp
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    curl \
    ca-certificates && \
    pip3 install --no-cache-dir --break-system-packages yt-dlp && \
    yt-dlp --version

RUN corepack enable && corepack prepare pnpm@latest --activate

# Non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Workspace config + root node_modules
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules

# lib/db
COPY --from=deps /app/lib/db/package.json ./lib/db/
COPY --from=deps /app/lib/db/node_modules ./lib/db/node_modules/
COPY --from=build-api /app/lib/db/src ./lib/db/src/

# lib/api-zod
COPY --from=deps /app/lib/api-zod/package.json ./lib/api-zod/
COPY --from=build-api /app/lib/api-zod/src ./lib/api-zod/src/

# api-server bundle
COPY --from=deps /app/artifacts/api-server/package.json ./artifacts/api-server/
COPY --from=deps /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules/
COPY --from=build-api /app/artifacts/api-server/dist ./artifacts/api-server/dist/

# Frontend static assets
COPY --from=build-frontend /app/artifacts/messaging-app/dist ./public/

RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/healthz || exit 1

# Cluster mode auto-activates in production
CMD ["node", "--enable-source-maps", \
     "--max-old-space-size=8192", \
     "./artifacts/api-server/dist/index.mjs"]
     
