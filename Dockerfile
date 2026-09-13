# ==============================================================================
# Stage 1: Build & Compile
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package descriptors & configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies including devDependencies
RUN pnpm install --frozen-lockfile

# Copy source code and build
COPY src ./src/
RUN pnpm run prisma:generate
RUN pnpm run build

# Prune dev dependencies for production image
RUN pnpm prune --prod

# ==============================================================================
# Stage 2: Production Runner
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install ffmpeg for audio voice-note processing and curl for Docker health check
RUN apk add --no-cache ffmpeg curl

# Create persistent data directories and set permissions for node user
RUN mkdir -p /app/data/auth /app/data/media && chown -R node:node /app

# Copy production artifacts from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Health check verifying HTTP liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run as non-root user
USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
