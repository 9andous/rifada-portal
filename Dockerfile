# Local/demo image. Production hardening is deferred (see docs/DECISIONS.md).
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-only placeholders: modules are loaded during `next build` but nothing connects.
# They do not reach the runtime stage, which gets real values from .env via docker compose.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-only-placeholder-never-used-at-runtime \
    BETTER_AUTH_URL=http://localhost:3000
RUN npx prisma generate && npm run build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
