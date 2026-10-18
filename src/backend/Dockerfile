# CubeClicker backend image — multi-stage (`dev` / `prod`).
# Build context is the repository root:
#   podman build --format docker --target dev  -f src/backend/Dockerfile .
#   podman build --format docker --target prod -f src/backend/Dockerfile .
# All COPY sources are root-relative.

# Every stage copies the root manifests plus both workspace manifests, so `npm ci`
# resolves the shared lockfile exactly as on the host.
# --- dev: tsx watch over bind-mounted sources (hot reload) ---
FROM docker.io/library/node:24-alpine AS dev

ENV NODE_ENV=development
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src/backend/package.json ./src/backend/package.json
COPY src/frontend/package.json ./src/frontend/package.json

RUN npm ci

COPY src/backend ./src/backend

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "dev", "-w", "@cubeclicker/backend"]

# --- build: compile the backend workspace to dist/ ---
FROM docker.io/library/node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src/backend/package.json ./src/backend/package.json
COPY src/frontend/package.json ./src/frontend/package.json

RUN npm ci

COPY src/backend ./src/backend

RUN npm run build -w @cubeclicker/backend

# --- prod-deps: production-only dependency tree ---
FROM docker.io/library/node:24-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY src/backend/package.json ./src/backend/package.json
COPY src/frontend/package.json ./src/frontend/package.json

RUN npm ci --omit=dev

# --- prod: non-root runtime with the compiled server ---
FROM docker.io/library/node:24-alpine AS prod

ENV NODE_ENV=production
WORKDIR /app/src/backend

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/src/backend/package.json ./package.json
COPY --from=build /app/src/backend/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

USER node

CMD ["node", "dist/server.js"]
