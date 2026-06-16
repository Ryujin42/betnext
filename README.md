# BetNext — Plateforme de paris sportifs

Application de paris sportifs centrée sur l'esport (LoL, CS2, Valorant). Cotes recalculées en temps réel, trois interfaces (web, mobile, admin), architecture en microservices (NestJS).

---

## Stack technique

| Couche | Technologies |
|--------|-------------|
| **Web (joueurs)** | React 19 · Vite · Zustand · Socket.io client · React Query |
| **Mobile (joueurs)** | React Native (Expo) · Zustand · Socket.io client · React Query |
| **Admin / Manager** | React 19 · Vite · TanStack Table · React Query (accès restreint ROLE_ADMIN / ROLE_MANAGER) |
| **UI partagée** | `libs/ui` · composants React · Tailwind config centralisée · design tokens |
| **API Gateway** | NestJS · JWT verify · Rate limit · Throttler · WebSocket · nginx |
| **Services métier** | NestJS (user, betting, event, wallet) |
| **Event bus** | Redis Pub/Sub · BullMQ |
| **Base de données** | PostgreSQL 16 (schéma unique `betnext`, 1 user applicatif) |
| **Cache / sessions** | Redis 7 |
| **Observabilité** | Prometheus · Grafana · Winston · Loki |
| **Jeux** | Adaptateurs LoL · CS2 · Valorant (IGameDataProvider) |

---

## Prérequis

- Node.js >= 20
- pnpm >= 9 (monorepo Nx)
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7

---

## Installation

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd betnext

# 2. Installer les dépendances (monorepo Nx)
pnpm install

# 3. Copier les fichiers d'environnement
cp .env.example .env
# Renseigner les variables requises (voir section Variables d'environnement)

# 4. Lancer l'infrastructure locale (PostgreSQL + Redis)
docker compose up -d postgres redis

# 5. Appliquer les migrations
pnpm db:migrate

# 6. Charger les données de démonstration
pnpm db:seed

# 7. Démarrer tous les services en développement
pnpm dev

# Ou démarrer un client spécifique
pnpm dev --filter=web      # Front joueurs (web)
pnpm dev --filter=mobile   # Front joueurs (Expo)
pnpm dev --filter=admin    # Interface admin/manager
pnpm dev --filter=api-gateway
```

---

## Comptes de démonstration

Tous les mots de passe sont `password`.

| Rôle | Email | Pseudo |
|------|-------|--------|
| Admin | admin@betnext-v2.gg | AdminBetNext |
| Manager | manager@betnext-v2.gg | Diarapak |
| Utilisateur | faker@betnext-v2.gg | Faker_Fan |
| Utilisateur | t1@betnext-v2.gg | T1_Enjoyer |
| Utilisateur | geng@betnext-v2.gg | GenG_King |
| Utilisateur | g2@betnext-v2.gg | G2_Believer |
| Utilisateur | blg@betnext-v2.gg | BLG_Support |

---

## Architecture

```
apps/
│
│   ── CLIENTS ──
├── web/                    → React 19 · Vite · Zustand · Socket.io client (joueurs)
├── mobile/                 → React Native (Expo) · Zustand · Socket.io client (joueurs)
├── admin/                  → React 19 · Vite · TanStack Table · React Query (ROLE_ADMIN + ROLE_MANAGER)
│                             Dashboard KPI · gestion utilisateurs · gestion événements · audit
│
│   ── BACKEND ──
├── api-gateway/            → Point d'entrée unique (JWT, rate limit, throttler, WS)
│
├── user-service/           → Auth · KYC · Jeu responsable · Argon2id
├── betting-service/        → Paris · Cotes · locked_odds
├── event-service/          → Compétitions · Game adapters (LoL, CS2, Valorant)
├── wallet-service/         → Stripe · Dépôt · Retrait · Solde
├── odds-engine/            → Recalcul des cotes · Redis lock 60s (consommateur BullMQ)
├── notification/           → Email · Push · WebSocket broadcast
└── audit-service/          → Table append-only ARJEL · conservation 5 ans

libs/
├── ui/                     → Composants React partagés (web + admin) · Tailwind config centralisée
├── ui-native/              → Composants React Native partagés (mobile) · NativeWind
├── shared-types/           → Types et DTOs partagés entre services
└── shared-utils/           → Helpers communs
```

### Les trois clients

| Client | Audience | Accès | Fonctionnalités clés |
|--------|----------|-------|----------------------|
| **web** | Joueurs (desktop/tablette) | Public + `ROLE_USER` | Paris, portefeuille, cotes live, jeu responsable |
| **mobile** | Joueurs (iOS / Android) | Public + `ROLE_USER` | Même périmètre que `web` · notifications push |
| **admin** | Équipe interne | `ROLE_ADMIN` + `ROLE_MANAGER` | Dashboard KPI · gestion utilisateurs · gestion événements · audit ARJEL · import données |

`web` et `admin` sont des SPAs React + Vite qui partagent `libs/ui` (composants, Tailwind, design tokens). `mobile` dispose de sa propre lib `libs/ui-native` (NativeWind) avec les mêmes tokens.



- **REST sync** : appels directs entre services pour les opérations synchrones
- **Redis Pub/Sub + BullMQ** : événements asynchrones (`bet.placed`, `bet.won`, `event.published`, `payment.deposited`, `rg.limit_updated`, `odds.updated`)
- **WebSocket** : broadcast temps réel vers `web` et `mobile` via Socket.io (cotes, résultats, notifications)

### Base de données
 
#### `users`
 
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | integer | PK |
| `name` | varchar | |
| `email` | varchar | UNIQUE NOT NULL |
| `birth_date` | date | |
 
#### `games`
 
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | integer | PK |
| `name` | varchar | |
 
#### `tournaments`
 
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | integer | PK |
| `name` | varchar | |
| `game_id` | integer | FK → `games.id` NOT NULL |
 
#### `e_sport_events`
 
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | integer | PK |
| `name` | varchar | |
| `start_date` | datetime | |
| `status` | varchar | |
| `tournament_id` | integer | FK → `tournaments.id` NOT NULL |
| `game_id` | integer | FK → `games.id` NOT NULL |
 
#### `teams`
 
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | integer | PK |
| `name` | varchar | |
| `enrolled_at` | timestamp | |
 
#### `event_teams`
 
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | integer | PK |
| `final_rank` | integer | |
| `e_sport_event_id` | integer | FK → `e_sport_events.id` NOT NULL |
| `team_id` | integer | FK → `teams.id` NOT NULL |
 
#### `outcomes`
 
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | integer | PK |
| `label` | varchar | |
| `is_winner` | boolean | |
| `odds` | decimal | |
| `condition` | json | |
| `e_sport_event_id` | integer | FK → `e_sport_events.id` NOT NULL |
| `event_player_id` | integer | FK → `event_teams.id` |
 
#### `bets`
 
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | integer | PK |
| `title` | varchar | |
| `created_at` | datetime | |
| `close_date` | datetime | |
| `amount` | decimal | |
| `locked_odds` | decimal | |
| `status` | varchar | |
| `outcome_id` | integer | FK → `outcomes.id` NOT NULL |
| `user_id` | integer | FK → `users.id` NOT NULL |
 
#### `bets_history`
 
| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | integer | PK |
| `old_status` | varchar | |
| `new_status` | varchar | |
| `reason` | varchar | |
| `created_at` | datetime | |
| `bet_id` | integer | FK → `bets.id` NOT NULL |
 
---

## Règles métier clés

### Cycle de vie d'un événement

```
BROUILLON → PUBLIE → FERME → TERMINE
BROUILLON / PUBLIE → ANNULE
```

| Statut | Description |
|--------|-------------|
| **BROUILLON** | Invisible aux joueurs · modifiable · supprimable |
| **PUBLIE** | Paris ouverts · suppression interdite |
| **FERME** | Plus de nouveaux paris · en attente du résultat |
| **TERMINE** | Résultat saisi · gains calculés · lecture seule |
| **ANNULE** | Paris remboursés · lecture seule |

### Cotes dynamiques

```
cote = total misé sur l'événement / total misé sur cette issue
```

- Bornes : **1.10 – 5.00** · Cote par défaut : **1.50**
- Recalcul asynchrone via `odds-engine` (Redis lock 60s)
- La cote est figée au moment du pari (`lockedOdds`)

### Jeu responsable

- Inscription refusée aux moins de 18 ans
- Auto-exclusion : bloque **la connexion** (pas uniquement les paris)
- Suspension : l'admin peut bloquer un compte
- Limites de mise et de dépôt (quotidien / hebdomadaire)
- Augmenter un plafond prend **48 heures** (mesure anti-impulsivité)

### Sécurité

- Mots de passe hashés via **Argon2id** (package `argon2` ; bcrypt déprécié)
- **Access token JWT court (5 min)** + **refresh token** stocké et haché en BDD (`sessions`) avec infos complémentaires (`ip`, `user_agent`, `device`, `last_used_at`…)
- Le refresh est **rotatif** (l'ancien est invalidé) et **re-vérifié en BDD** à chaque appel ; le client renouvelle l'access token de façon transparente (intercepteur _fetch-and-retry_ sur `401`)
- JWT vérifié à l'API Gateway (aucun service interne ne refait la vérification)
- Audit ARJEL : table PostgreSQL **append-only**, jamais de UPDATE/DELETE, conservation 5 ans

---

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | DSN PostgreSQL principal |
| `REDIS_URL` | URL Redis (cache + BullMQ) |
| `JWT_SECRET` | Secret de signature des tokens JWT |
| `JWT_ACCESS_EXPIRY` | Durée de vie de l'access token (`5m`) |
| `JWT_REFRESH_EXPIRY` | Durée de vie du refresh token (`7d`) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret de validation des webhooks Stripe |
| `RIOT_API_KEY` | Clé Riot Games API (EUW) |
| `RIOT_PLATFORM` | Plateforme Riot (`euw1`) |
| `RIOT_REGION` | Région Riot (`europe`) |
| `LOL_ESPORTS_API_KEY` | Clé API LoL Esports (publique) |

---

## Observabilité

| Outil | Rôle |
|-------|------|
| **Prometheus** | Collecte des métriques temps réel |
| **Grafana** | Dashboards et alertes |
| **Winston + Loki** | Logs structurés JSON, centralisés |
| **Audit ARJEL** | Table PostgreSQL append-only · 5 ans de rétention |
