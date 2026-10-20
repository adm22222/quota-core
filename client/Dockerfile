
FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/package.json

RUN pnpm install --filter client... --frozen-lockfile

FROM deps AS builder
WORKDIR /app

COPY client ./client

ENV QUOTA_API_URL=http://api:3000/api/v1

RUN pnpm --dir /app/client install --frozen-lockfile
RUN pnpm --dir /app/client build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/client ./client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

EXPOSE 3001

CMD ["pnpm", "--dir", "/app/client", "start"]
