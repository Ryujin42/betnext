# ─────────────────────────────────────────────────────────────────────────
# Image générique d'un service backend NestJS du monorepo (Lot 12 — T12.1).
#
# Un seul Dockerfile pour tous les services : on passe le nom du package via
# l'ARG `APP` (ex. `api-gateway`, `betting-service`). pnpm construit le service
# ET ses dépendances libs (`@betnext/*`) dans l'ordre topologique. Les services
# métier sont **stateless** → réplicables horizontalement derrière nginx.
# ─────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

# Outils natifs requis par argon2 (user-service) au build.
RUN apk add --no-cache python3 make g++
RUN corepack enable

WORKDIR /app
# Copie le monorepo (le .dockerignore exclut node_modules/dist).
COPY . .

# Installe toutes les deps du workspace (lockfile figé) puis construit le
# service ciblé et ses dépendances libs. On déduit le **nom de package** depuis
# le dossier (`apps/<APP>`) car il peut en différer (ex. dossier `notification`
# → paquet `notification-service`), puis on filtre par nom : `<pkg>...` ajoute
# les dépendances libs `@betnext/*` (construites avant l'app, ordre topologique).
RUN pnpm install --frozen-lockfile
ARG APP
RUN test -n "$APP" || (echo "build-arg APP requis" && false)
RUN PKG=$(node -p "require('./apps/${APP}/package.json').name") \
  && echo "Build du paquet '$PKG' (apps/${APP}) + dépendances" \
  && pnpm --filter "${PKG}..." run build

# ── Image d'exécution ────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app

# On embarque le monorepo construit : les liens workspace de node_modules
# pointent vers les `libs/*/dist` présents → résolution `@betnext/*` correcte.
COPY --from=build /app /app

ARG APP
ENV APP=${APP}
WORKDIR /app/apps/${APP}
USER node
# `sh -c` pour interpoler $APP (CMD exec ne fait pas d'expansion shell).
CMD ["sh", "-c", "node dist/main.js"]
