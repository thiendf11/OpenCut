FROM oven/bun:alpine AS base

# Install dependencies and build the application
FROM base AS builder

WORKDIR /app

ARG FREESOUND_CLIENT_ID
ARG FREESOUND_API_KEY
ARG CLOUDFLARE_ACCOUNT_ID
ARG R2_ACCESS_KEY_ID
ARG R2_SECRET_ACCESS_KEY
ARG R2_BUCKET_NAME
ARG MODAL_TRANSCRIPTION_URL
ARG BETTER_AUTH_SECRET
ARG UPSTASH_REDIS_REST_URL
ARG UPSTASH_REDIS_REST_TOKEN

COPY package.json package.json
COPY bun.lock bun.lock
COPY turbo.json turbo.json

COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/auth/package.json packages/auth/package.json

RUN bun install

# Copy source files, excluding node_modules
COPY apps/web/src apps/web/src
COPY apps/web/public apps/web/public
COPY apps/web/migrations apps/web/migrations
COPY apps/web/*.ts apps/web/
COPY apps/web/*.js apps/web/
COPY apps/web/*.mjs apps/web/
COPY apps/web/*.json apps/web/
COPY apps/web/*.md apps/web/
COPY apps/web/Dockerfile apps/web/Dockerfile

COPY packages/db/src packages/db/src
COPY packages/db/migrations packages/db/migrations
COPY packages/db/*.ts packages/db/
COPY packages/db/*.json packages/db/

COPY packages/auth/src packages/auth/src
COPY packages/auth/*.ts packages/auth/
COPY packages/auth/*.json packages/auth/

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
# Set build-time environment variables for validation
ENV DATABASE_URL="postgresql://opencut:opencutthegoat@localhost:5432/opencut"
ENV BETTER_AUTH_SECRET="build-time-secret"
ENV UPSTASH_REDIS_REST_URL="http://localhost:8079"
ENV UPSTASH_REDIS_REST_TOKEN="example_token"
ENV NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"

ENV FREESOUND_CLIENT_ID=$FREESOUND_CLIENT_ID
ENV FREESOUND_API_KEY=$FREESOUND_API_KEY
ENV CLOUDFLARE_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID
ENV R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID
ENV R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
ENV R2_BUCKET_NAME=$R2_BUCKET_NAME
ENV MODAL_TRANSCRIPTION_URL=$MODAL_TRANSCRIPTION_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ENV UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL
ENV UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN

WORKDIR /app/apps/web
RUN bun run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

RUN chown nextjs:nodejs apps

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"


CMD ["bun", "apps/web/server.js"]

