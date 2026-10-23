
# syntax=docker/dockerfile:1

FROM node:22-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
COPY docs ./docs

# Used by Prisma config during client generation only.
ENV DATABASE_URL="postgresql://quota_user:build_only@localhost:5432/quota_core?schema=public"

RUN pnpm prisma generate

FROM base AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/docs ./docs
COPY --from=build /app/prisma.config.ts /app/tsconfig.json ./
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/package.json

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm start"]
