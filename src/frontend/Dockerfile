# CubeClicker frontend image — multi-stage (`dev` for hot-reload development, `prod` for static serving).
# Build context is the repository root:  podman build --format docker --target dev|prod -f src/frontend/Dockerfile .
# No secrets and no environment-specific values are baked in; runtime config comes from the environment.

# --- dev: Vite dev server on 5173 (source is bind-mounted by compose for hot reload) ---
FROM docker.io/library/node:24-alpine AS dev

WORKDIR /app

# Root manifests + both workspace manifests are required for `npm ci` (npm workspaces).
COPY package.json package-lock.json tsconfig.json ./
COPY src/backend/package.json src/backend/package.json
COPY src/frontend/package.json src/frontend/package.json
RUN npm ci

# The workspace source keeps the dev image runnable standalone as well.
COPY src/frontend src/frontend

EXPOSE 5173

# Health signal for the compose stack: the dev server answers `/`.
HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "dev", "-w", "@cubeclicker/frontend"]

# --- build: type-agnostic production build of the SPA (vite build → dist/) ---
FROM docker.io/library/node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src/backend/package.json src/backend/package.json
COPY src/frontend/package.json src/frontend/package.json
RUN npm ci

COPY src/frontend src/frontend
RUN npm run build -w @cubeclicker/frontend

# --- prod: unprivileged nginx serving the static build on 8080 (non-root by image default) ---
FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine AS prod

COPY src/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/src/frontend/dist/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
