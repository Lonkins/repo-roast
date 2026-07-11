# syntax=docker/dockerfile:1

# --- deps: install with a warm pnpm store ---
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- builder: produce the standalone Next.js server ---
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DOCKER_BUILD flips next.config.ts to output: "standalone"
ENV DOCKER_BUILD=1 NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- runner: minimal image with git + gitleaks for full-history scanning ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # self-host uses the gitleaks binary path over a full clone
    GITLEAKS_BINARY=1

# git for cloning target repos; gitleaks binary pinned to a known version
ARG GITLEAKS_VERSION=8.30.1
RUN apk add --no-cache git ca-certificates \
    && ARCH="$(uname -m)" \
    && case "$ARCH" in \
         x86_64) GL_ARCH=x64 ;; \
         aarch64|arm64) GL_ARCH=arm64 ;; \
         *) echo "unsupported arch $ARCH" && exit 1 ;; \
       esac \
    && wget -qO /tmp/gitleaks.tar.gz \
       "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GL_ARCH}.tar.gz" \
    && tar -xzf /tmp/gitleaks.tar.gz -C /usr/local/bin gitleaks \
    && rm /tmp/gitleaks.tar.gz \
    && gitleaks version

# Run as an unprivileged user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

# Next.js standalone output: server + only the deps it actually needs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
