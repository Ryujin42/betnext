# BetNext — Contexte Projet Complet

> Document de référence technique et fonctionnel. À placer à la racine du monorepo.
> Projet NestJS · ESGI 4ème année IW · 2025-2026
> Dernière mise à jour : juin 2026

---

## 1. Vision & Objectif

BetNext est une plateforme de paris e-sport refondée de zéro en NestJS.
Elle remplace un monolithe Symfony existant qui souffrait de trois problèmes critiques :
- Support d'un seul jeu (League of Legends uniquement)
- Codebase monolithique avec dette technique majeure
- Croissance bloquée par le couplage fort entre domaines

La nouvelle plateforme doit être **scalable horizontalement**, **modulaire**, **prête pour plusieurs jeux**, **multi-client (web, mobile, admin)**, et conforme à la **législation française sur les jeux d'argent (ARJEL)**.

> **Contexte projet école** : les intégrations externes payantes ou à quota (Stripe, API Riot) sont **mockées** derrière une interface. L'implémentation réelle reste branchable plus tard sans modifier le reste du code, grâce à l'abstraction par interface.

---

## 2. Stack Technologique

### Monorepo & outillage
| Technologie | Rôle | Justification |
|---|---|---|
| Nx monorepo | Gestion multi-apps/libs | Types partagés, CI unifié, libs communes |
| pnpm >= 9 | Gestionnaire de paquets | Workspaces performants, adapté au monorepo Nx |
| Node.js >= 20 | Runtime | Stabilité long terme |
| TypeScript 5 (strict) | Typage | Sécurité à la compilation, partagé front/back |

### Backend
| Technologie | Rôle | Justification |
|---|---|---|
| NestJS | Framework principal | Modules, DI, decorators — structurant par nature |
| Fastify | Adaptateur HTTP | ~2× plus rapide qu'Express, swap transparent dans NestJS |
| Passport.js + JWT | Auth | Stratégies multiples (local, JWT refresh) |
| class-validator + class-transformer | Validation DTO | Déclaratif, intégré NestJS |
| Socket.io | WebSockets | Cotes en temps réel, notifications live |

### Data & Cache
| Technologie | Rôle | Justification |
|---|---|---|
| PostgreSQL 16 | Base de données principale | 1 instance, 4 schémas isolés par service |
| TypeORM | ORM + migrations | Intégration NestJS native, migrations versionnées |
| Redis 7 | Cache, sessions, verrous | Ultra-rapide, déjà nécessaire pour BullMQ |
| ioredis | Client Redis Node.js | Gestion connexions, reconnexion auto, pub/sub |

### Messaging & Queues
| Technologie | Rôle | Justification vs alternatives |
|---|---|---|
| BullMQ | Files d'attente asynchrones | Redis-backed, retry natif, dashboard inclus. Kafka serait overkill (<10k msg/sec) |
| Redis Pub/Sub | Event bus inter-services | Léger, sans broker supplémentaire. Kafka et ActiveMQ écartés (complexité opérationnelle, écosystème Java pour ActiveMQ) |
| NestJS EventEmitter | Événements intra-service | Communication synchrone locale, sans overhead réseau |

### Frontend — 3 clients
| Client | Audience | Stack | Accès |
|---|---|---|---|
| **web** | Joueurs (desktop/tablette) | React 19 · Vite · Zustand · React Query · Socket.io client | Public + `ROLE_USER` |
| **mobile** | Joueurs (iOS / Android) | React Native (Expo) · Zustand · React Query · Socket.io client | Public + `ROLE_USER` |
| **admin** | Équipe interne | React 19 · Vite · TanStack Table · React Query | `ROLE_ADMIN` + `ROLE_MANAGER` |

| Technologie transversale | Rôle |
|---|---|
| Tailwind CSS | Styles utilitaires (config centralisée) |
| NativeWind | Tailwind pour React Native (mobile) |
| Recharts | Graphiques dashboard et profil (courbes, barres, camemberts) |
| Zustand | État global client (user connecté, solde, cotes live) |
| React Query (TanStack) | État serveur, cache requêtes, invalidation |

`web` et `admin` sont des SPAs React + Vite qui partagent `libs/ui` (composants, Tailwind, design tokens). `mobile` dispose de sa propre lib `libs/ui-native` (NativeWind) avec les **mêmes design tokens**. C'est ce partage qui rend le « passage sur mobile » peu coûteux : les contrats de données (`shared-types`) sont strictement identiques entre les trois clients.

### Paiement & Sécurité
| Technologie | Rôle |
|---|---|
| Stripe (mocké) | PSP (dépôt, retrait, webhooks) — `MockStripeProvider` derrière `IPaymentProvider` |
| bcrypt | Hachage mots de passe |
| Helmet | Headers HTTP de sécurité (XSS, clickjacking, sniffing) |
| @nestjs/throttler | Rate limiting par route ou global |
| CSRF protection | Double-submit cookie pattern |

### Observabilité
| Technologie | Rôle |
|---|---|
| Prometheus + prom-client | Métriques (latence, volume paris, erreurs) |
| Grafana | Dashboards temps réel |
| Loki | Agrégation et recherche de logs |
| Winston | Logger structuré JSON (alimente Loki) |
| Table audit immuable | Append-only PostgreSQL pour traçabilité ARJEL |

> **Audit vs Monitoring — distinction importante** : le monitoring (Prometheus/Grafana) sert à la supervision technique en temps réel (alertes, SLA). L'audit (table append-only) sert à la traçabilité réglementaire et légale — chaque action sensible y est inscrite, jamais modifiée, jamais supprimée.

### Infra & DevOps
| Technologie | Rôle |
|---|---|
| Docker + Docker Compose | Conteneurisation, dev local |
| GitHub Actions | CI/CD |
| nginx | Reverse proxy / load balancer |
| ConfigModule (NestJS) | Gestion variables d'environnement |

### Qualité & Tests
| Technologie | Rôle |
|---|---|
| Jest | Tests unitaires |
| Supertest | Tests e2e HTTP |
| ESLint + Prettier | Lint et formatage |
| Husky + lint-staged | Pre-commit hooks |
| Swagger / OpenAPI | Documentation API auto-générée |

---

## 3. Architecture Globale

### Pattern : Monorepo multi-services avec Event Bus

```
apps/
│   ── CLIENTS ──
├── web/                  → React 19 · Vite (joueurs desktop/tablette)
├── mobile/               → React Native Expo (joueurs iOS/Android)
├── admin/                → React 19 · Vite · TanStack Table (ROLE_ADMIN + ROLE_MANAGER)
│
│   ── BACKEND ──
├── api-gateway/          → Point d'entrée unique (auth, routing, rate limit, WS)
├── user-service/         → Authentification, profils, KYC, jeu responsable
├── betting-service/      → Paris, cotes, verrou 1 minute, résolution
├── event-service/        → Compétitions, game adapters, résultats
├── wallet-service/       → Transactions, paiement (Stripe mocké), soldes
├── odds-engine/          → Recalcul des cotes (consommateur d'events)
├── notification/         → Email, push, WebSocket (consommateur d'events)
└── audit-service/        → Traçabilité immuable (consommateur d'events)
libs/
├── ui/                   → Composants React partagés (web + admin) · Tailwind · design tokens
├── ui-native/            → Composants React Native partagés (mobile) · NativeWind
├── shared-types/         → Interfaces et DTOs partagés (User, Bet, Event...)
├── shared-events/        → Définition des événements du bus (BetPlaced, etc.)
└── shared-utils/         → Helpers communs (dates, money, validation)
```

### Communication entre services

- **Synchrone (REST interne)** : pour les réponses immédiates nécessaires dans le flux de la requête (ex: vérifier le solde avant de placer un pari)
- **Asynchrone (Redis Pub/Sub / BullMQ)** : pour tout ce qui peut être traité en background (recalcul des cotes, envoi d'email, audit)
- **WebSocket (Socket.io)** : pour les mises à jour en temps réel vers `web` et `mobile` (cotes live, résultats, notifications)

### Flux d'un pari (exemple complet)

```
Client → API Gateway (JWT check) → Betting Service
  → [sync] User Service : vérifier limites jeu responsable
  → [sync] Wallet Service : vérifier solde suffisant
  → [sync] Redis : acquérir verrou 1 minute sur l'événement
  → [write] betting.bets : persister le pari (cote figée dans locked_odds)
  → [publish] bet.placed event sur Redis Pub/Sub
    ├── Odds Engine : recalcule les cotes
    ├── Wallet Service : débite le solde
    ├── Notification : notifie le user (WebSocket / push)
    └── Audit Service : inscrit l'action (immuable)
  → [release] Verrou Redis
  → Réponse HTTP au client
```

---

## 4. Base de Données

### Principe : 1 instance PostgreSQL, 4 schémas isolés

**Pourquoi pas une base unique partagée ?**
La base unique fonctionne techniquement mais la discipline s'érode : sous pression de deadline, un dev fait une jointure `bets JOIN users` directe, et toute l'isolation disparaît sans qu'on s'en rende compte. Une migration sur `users.*` casse alors le Betting Service.

**Pourquoi pas 4 instances séparées ?**
Complexité opérationnelle inutile pour ce stade du projet. 4 serveurs PostgreSQL à maintenir, backuper, monitorer.

**Notre compromis : 1 instance, 4 schémas, 4 users SQL**

```sql
-- Chaque service a son propre schéma et son propre user SQL
CREATE SCHEMA users;
CREATE SCHEMA betting;
CREATE SCHEMA events;
CREATE SCHEMA wallet;

-- Le user "betting_svc" ne voit QUE le schéma betting
CREATE USER betting_svc WITH PASSWORD '...';
GRANT ALL ON SCHEMA betting TO betting_svc;
-- Pas de GRANT sur users.*, events.*, wallet.*
```

**Conséquence : pas de jointures cross-schéma.**
Pour obtenir les paris d'un utilisateur avec son nom, on fait deux appels :
1. Betting Service → `SELECT * FROM betting.bets WHERE user_id = $1`
2. User Service → `SELECT name, email FROM users.users WHERE id = $1`
3. Assemblage dans l'API Gateway / le client

Le résultat final est identique pour le client. La différence est invisible pour l'utilisateur.

**Pour les vues agrégées fréquentes** (dashboard admin « tous les paris avec info user ») : vue matérialisée en Redis, reconstituée à chaque événement `bet.placed`.

### Schéma de données (modèle relationnel)

> Les identifiants sont des `integer` auto-incrémentés. Le découpage logique ci-dessous correspond aux 4 schémas isolés.

#### Schéma `users`

**`users`**
| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer | PK |
| `name` | varchar | |
| `email` | varchar | UNIQUE NOT NULL |
| `password_hash` | varchar | NOT NULL |
| `roles` | varchar[] | (ROLE_ADMIN / ROLE_MANAGER / ROLE_USER) |
| `birth_date` | date | (vérif. 18 ans à l'inscription) |
| `created_at` | timestamp | |

**`sessions`** — refresh tokens
`id` · `user_id` (FK) · `refresh_token_hash` · `expires_at` · `ip` · `user_agent`

**`rg_profiles`** — jeu responsable
`id` · `user_id` (FK) · `daily_bet_limit` · `weekly_bet_limit` · `daily_deposit_limit` · `weekly_deposit_limit` · `self_excluded_until` · `limit_updated_at`

**`audit_rg`** — append-only
`id` · `user_id` (FK) · `action` · `old_value` · `new_value` · `created_at`

#### Schéma `events`

**`games`**
| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer | PK |
| `name` | varchar | (`lol`, `cs2`, `valorant`...) |

**`tournaments`**
| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer | PK |
| `name` | varchar | |
| `game_id` | integer | FK → `games.id` NOT NULL |

> Relation `1 jeu → N tournois` : la FK `game_id` vit dans `tournaments` (côté « plusieurs »). Un tournoi appartient toujours à un seul jeu.

**`e_sport_events`**
| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer | PK |
| `name` | varchar | |
| `start_date` | datetime | |
| `status` | varchar | (cycle de vie ci-dessous) |
| `tournament_id` | integer | FK → `tournaments.id` NOT NULL |
| `game_id` | integer | FK → `games.id` NOT NULL (dénormalisé pour éviter un JOIN) |

**`teams`**
| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer | PK |
| `name` | varchar | |
| `enrolled_at` | timestamp | |

**`event_teams`** — table pivot N équipes par événement
| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer | PK |
| `final_rank` | integer | (classement final une fois l'event résolu) |
| `e_sport_event_id` | integer | FK → `e_sport_events.id` NOT NULL |
| `team_id` | integer | FK → `teams.id` NOT NULL |

> C'est cette table qui rend le nombre d'équipes **dynamique** : 2 lignes pour un duel classique, 8+ pour un bracket ou un battle royale. On ne hardcode jamais `team_a` / `team_b`.

**`outcomes`** — issues pariables
| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer | PK |
| `label` | varchar | (« Team A gagne », « match < 20 min »...) |
| `is_winner` | boolean | (null = non résolu) |
| `odds` | decimal | |
| `condition` | json | (type de pari, voir §5) |
| `e_sport_event_id` | integer | FK → `e_sport_events.id` NOT NULL |
| `event_player_id` | integer | FK → `event_teams.id` **NULLABLE** |

> `event_player_id` est **nullable** : un outcome lié à une équipe le renseigne (« Team A gagne »), un outcome transverse au match le laisse null (« match < 20 min », « + de 30 kills »). Le champ `condition` JSON décrit le type d'issue et sa logique de résolution.

#### Schéma `betting`

**`bets`**
| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer | PK |
| `title` | varchar | |
| `created_at` | datetime | |
| `close_date` | datetime | |
| `amount` | decimal | |
| `locked_odds` | decimal | (cote figée au moment du pari) |
| `status` | varchar | (PENDING / WON / LOST / CANCELLED) |
| `outcome_id` | integer | FK → `outcomes.id` NOT NULL |
| `user_id` | integer | FK → `users.id` NOT NULL (réf. logique, pas de FK SQL cross-schéma) |

**`bets_history`** — append-only
| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer | PK |
| `old_status` | varchar | |
| `new_status` | varchar | |
| `reason` | varchar | |
| `created_at` | datetime | |
| `bet_id` | integer | FK → `bets.id` NOT NULL |

#### Schéma `wallet`

**`transactions`**
`id` · `user_id` (réf. logique) · `type` · `amount` · `description` · `stripe_id` (unique, idempotence) · `created_at`

**`balances`** — source de vérité du solde
`id` · `user_id` (réf. logique) · `amount` · `updated_at`

> Note : les références `user_id` dans `betting` et `wallet` sont des références **logiques** (pas de contrainte FK SQL vers `users.users`, puisque c'est un autre schéma). L'intégrité est garantie applicativement.

---

## 5. Types de Paris (outcomes.condition)

### Principe

Un pari ne se limite pas à « telle équipe gagne ». Pour supporter des conditions variées (durée du match, nombre de kills, premier sang...) sans multiplier les colonnes nullable, le type de pari est décrit dans un champ **JSON `condition`**, parsé et validé côté code.

### Structure typée (discriminated union)

```typescript
// libs/shared-types/src/outcome-condition.type.ts
export type OutcomeCondition =
  | { type: 'TEAM_WINS' }
  | { type: 'MATCH_DURATION'; operator: 'LESS_THAN' | 'GREATER_THAN'; threshold: number; unit: 'minutes' }
  | { type: 'TOTAL_KILLS'; operator: 'LESS_THAN' | 'GREATER_THAN'; threshold: number }
  | { type: 'FIRST_BLOOD'; eventPlayerId: number };
```

Exemples de valeurs stockées dans `outcomes.condition` :

```json
{ "type": "MATCH_DURATION", "operator": "LESS_THAN", "threshold": 20, "unit": "minutes" }
```
```json
{ "type": "TOTAL_KILLS", "operator": "GREATER_THAN", "threshold": 30 }
```

### Résolution

Le service de résolution (`betting-service/resolution`) fait un `switch (condition.type)` pour appliquer la bonne logique de calcul du gagnant. Ajouter un nouveau type de pari = ajouter un cas au union et au switch, **sans toucher** au reste du code (principe Open/Closed).

---

## 6. Gestion des Cotes

### Formule de calcul

```
cote_issue = total_misé_sur_événement / total_misé_sur_issue
Bornes : MIN 1.10 — MAX 5.00
Cote par défaut (aucun pari) : 1.50
```

### Verrou anti-concurrence (race condition)

Problème : deux paris arrivant simultanément sur le même événement peuvent lire les mêmes totaux et calculer des cotes incohérentes.

Solution : verrou Redis avec `SET NX EX 60` (mutex d'une minute par événement).

```typescript
// Odds Engine — pseudo-code
const lockKey = `odds:lock:event:${eventId}`;
const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 60);
if (!acquired) {
  // Un recalcul est déjà en cours — on attend ou on skip
  return;
}
try {
  await recalculateOdds(eventId);
} finally {
  await redis.del(lockKey);
}
```

### Cote figée (locked odds)

La cote est capturée au moment exact du pari et stockée dans `betting.bets.locked_odds`. Les recalculs ultérieurs n'affectent pas les paris déjà placés.

---

## 7. Système d'Authentification & Rôles

### 3 rôles

| Rôle | Accès |
|---|---|
| `ROLE_ADMIN` | Dashboard technique, monitoring, gestion utilisateurs, suspension |
| `ROLE_MANAGER` | Création/gestion événements, saisie résultats, import données |
| `ROLE_USER` | Paris, wallet, profil, historique |

### Flux auth
1. Login → User Service → vérifie password (bcrypt) → retourne `access_token` (15min) + `refresh_token` (7j)
2. Chaque requête → API Gateway vérifie le JWT → injecte `userId` et `roles` dans les headers internes
3. Les services internes **ne re-vérifient pas** le token : ils font confiance aux headers injectés par le gateway
4. Refresh → endpoint dédié avec rotation du refresh token (le précédent est invalidé)

### Contraintes légales sur l'inscription (ARJEL)
- Âge minimum 18 ans vérifié à l'inscription (date de naissance obligatoire)
- Email vérifié avant activation du compte
- Acceptation explicite des CGU et politique jeu responsable

---

## 8. Jeu Responsable (Législation Française ARJEL)

Toutes ces règles sont **obligatoires** en France pour les plateformes de jeux d'argent.

### Limites configurables par l'utilisateur
- Limite de mise quotidienne / hebdomadaire
- Limite de dépôt quotidienne / hebdomadaire

### Règle des 48h (anti-impulsivité)
- **Diminuer** une limite → effectif immédiatement
- **Augmenter** une limite → effectif après 48h de délai de réflexion (`LIMIT_INCREASE_PENDING`)
- Pendant les 48h, l'ancienne limite reste active

### Auto-exclusion
- L'utilisateur peut s'exclure pour une durée minimale (ex: 7 jours, 30 jours, 6 mois)
- L'auto-exclusion bloque la **connexion** (pas seulement les paris)
- Ne peut pas être annulée avant la fin de la durée choisie

### Suspension admin
- Un admin peut suspendre un compte (comportement suspect, fraude, etc.)
- Bloque la connexion immédiatement

### Inscription refusée
- Moins de 18 ans → refus à l'inscription
- Personne sous auto-exclusion qui tente de recréer un compte → détection par email/identité

### Toutes les actions RG sont auditées
Chaque modification de limite, auto-exclusion, suspension est inscrite dans `users.audit_rg` (append-only, jamais de UPDATE/DELETE).

---

## 9. Game Adapters (Extensibilité)

### Interface commune

Pour supporter plusieurs jeux sans modifier le code existant (principe Open/Closed) :

```typescript
// libs/shared-types/src/game-adapter.interface.ts
export interface IGameDataProvider {
  getAdapterType(): string;                          // 'lol', 'cs2', 'valorant'...
  fetchLiveEvents(): Promise<ExternalEvent[]>;
  fetchEventResult(externalId: string): Promise<EventResult>;
  mapToSportEvent(raw: ExternalEvent): CreateEventDto;
}
```

### Adapters

> En contexte école, on démarre avec un adapter **mocké** (`MockLolAdapter`) retournant des données en dur, pour ne pas dépendre d'une API externe à quota. Le vrai adapter Riot se branche ensuite sans rien changer ailleurs.

- `MockLolAdapter` → données LoL en dur (démarrage)
- `LolEsportsAdapter` → API LoL Esports (réel, prévu)
- `RiotRankedAdapter` → API Riot Games ranked (réel, prévu)
- `Cs2Adapter` → à créer (même interface)
- `ValorantAdapter` → à créer (même interface)

### Ajout d'un nouveau jeu
1. Créer une classe qui implémente `IGameDataProvider`
2. L'enregistrer dans le module NestJS
3. Aucune autre modification — le Event Service découvre les adapters automatiquement via injection

---

## 10. Cycle de vie d'un événement

```
BROUILLON → PUBLIE → FERME → TERMINE
BROUILLON / PUBLIE → ANNULE
```

| Statut | Description |
|---|---|
| **BROUILLON** | Invisible aux joueurs · modifiable · supprimable |
| **PUBLIE** | Paris ouverts · suppression interdite |
| **FERME** | Plus de nouveaux paris · en attente du résultat |
| **TERMINE** | Résultat saisi · gains calculés · lecture seule |
| **ANNULE** | Paris remboursés · lecture seule |

### Règles métier non négociables
- Un pari ne peut être placé que si l'événement est en statut `PUBLIE`
- Un pari ne peut être placé après le début de l'événement (`start_date <= now()`)
- La cote est **toujours** figée au moment du pari (`locked_odds`)
- Tout crédit/débit de solde génère **obligatoirement** une transaction en DB
- Toute action sensible (pari, dépôt, modification RG, suspension) est **obligatoirement** auditée

---

## 11. Monitoring & Observabilité

### Séparation monitoring / audit

| | Monitoring | Audit |
|---|---|---|
| Outil | Prometheus + Grafana | Table PostgreSQL append-only |
| But | Supervision technique temps réel | Traçabilité réglementaire |
| Données | Métriques (latence, volume, erreurs) | Actions métier (pari placé, limite modifiée...) |
| Rétention | Court terme (30j) | Long terme (légal, 5 ans min) |
| Modifiable | Oui (purge automatique) | Non (jamais de UPDATE/DELETE) |

### Métriques clés à exposer (Prometheus)
- `betnext_bets_total` — nombre de paris par statut
- `betnext_bet_amount_sum` — volume financier total misé
- `betnext_odds_calculation_duration_ms` — latence recalcul cotes
- `betnext_active_users_gauge` — utilisateurs connectés en temps réel
- `betnext_stripe_webhook_errors_total` — échecs paiement (mock)
- `betnext_rg_limit_hits_total` — nombre de fois qu'une limite jeu responsable est atteinte

### Logs structurés (Winston → Loki)
Chaque log doit contenir :
```json
{
  "timestamp": "2026-06-15T10:30:00Z",
  "level": "error",
  "service": "betting-service",
  "traceId": "abc-123",
  "userId": 42,
  "message": "Bet placement failed",
  "reason": "insufficient_balance",
  "amount": 50.00
}
```

---

## 12. Paiement (Stripe mocké)

> Pour le projet école, le PSP est abstrait derrière `IPaymentProvider`. `MockStripeProvider` simule les flux sans réseau ni argent réel. Un `RealStripeProvider` peut être branché plus tard via les variables d'environnement, sans toucher au wallet-service.

### Interface

```typescript
export interface IPaymentProvider {
  createPaymentIntent(amount: number, userId: number): Promise<PaymentIntentResult>;
  confirmPayment(intentId: string): Promise<void>;
  handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent>;
}
```

### Flux dépôt (mocké)
1. User initie un dépôt → Wallet Service crée un `PaymentIntent` (mock)
2. Le front « confirme » (simulation côté mock)
3. Webhook simulé `payment_intent.succeeded` → Wallet Service crédite le solde
4. Transaction inscrite dans `wallet.transactions`

### Flux retrait (mocké)
1. User demande un retrait → vérifié contre solde disponible + limites RG
2. Transfert simulé
3. Transaction inscrite, statut `PENDING` puis `COMPLETED`

### Idempotence
- Vérifier que l'event de paiement n'a pas déjà été traité (`stripe_id` unique en DB)
- Un rejeu du même webhook est ignoré

---

## 13. Gestion d'Erreurs

### Principe : toutes les erreurs possibles doivent être gérées explicitement

#### Codes d'erreur métier standardisés
```typescript
export enum BetNextErrorCode {
  // Auth
  INVALID_CREDENTIALS      = 'AUTH_001',
  TOKEN_EXPIRED            = 'AUTH_002',
  ACCOUNT_SUSPENDED        = 'AUTH_003',
  ACCOUNT_SELF_EXCLUDED    = 'AUTH_004',
  UNDERAGE                 = 'AUTH_005',

  // Paris
  EVENT_NOT_PUBLISHED      = 'BET_001',
  EVENT_ALREADY_STARTED    = 'BET_002',
  INSUFFICIENT_BALANCE     = 'BET_003',
  DAILY_LIMIT_REACHED      = 'BET_004',
  WEEKLY_LIMIT_REACHED     = 'BET_005',
  ODDS_CHANGED             = 'BET_006',  // cote modifiée entre affichage et soumission
  LOCK_ACQUISITION_FAILED  = 'BET_007',  // trop de concurrence, retry

  // Wallet
  DEPOSIT_LIMIT_REACHED    = 'WAL_001',
  PAYMENT_FAILED           = 'WAL_002',
  INSUFFICIENT_FUNDS       = 'WAL_003',

  // Jeu responsable
  LIMIT_INCREASE_PENDING   = 'RG_001',   // augmentation en attente 48h
  SELF_EXCLUSION_ACTIVE    = 'RG_002',
}
```

#### Format de réponse d'erreur uniforme
```json
{
  "statusCode": 400,
  "errorCode": "BET_003",
  "message": "Solde insuffisant pour placer ce pari.",
  "details": {
    "required": 50.00,
    "available": 32.50
  },
  "traceId": "abc-123-def"
}
```

#### Gestion des pannes de services (résilience)
- Si le Notification est down → le pari est quand même placé (non bloquant)
- Si le Odds Engine est down → les cotes restent à la dernière valeur connue (cache Redis)
- Si le paiement (mock) est down → le dépôt est mis en queue BullMQ avec retry exponentiel
- Pas de propagation en cascade : chaque service gère ses propres erreurs

---

## 14. Scalabilité Horizontale

### Ce qui est stateless (scalable immédiatement)
- API Gateway : plusieurs instances derrière nginx
- Betting Service, User Service, Event Service, Wallet Service : stateless, scalables
- Clients `web` / `admin` : build statique servi par CDN + plusieurs instances

### Ce qui nécessite attention
- **Redis** : point central — utiliser Redis Sentinel ou Redis Cluster en prod
- **Verrous distribués** : le verrou de cotes doit être sur Redis Cluster pour rester cohérent sur plusieurs instances
- **WebSockets** : Socket.io avec Redis adapter pour partager les rooms entre instances
- **BullMQ** : les workers peuvent être scalés indépendamment

### Scaling horizontal concret
```yaml
# docker-compose.prod.yml — exemple de scaling
betting-service:
  deploy:
    replicas: 3        # 3 instances du Betting Service
odds-engine:
  deploy:
    replicas: 2        # 2 workers de recalcul
```

---

## 15. Événements du Bus (Contrat)

Tous les événements sont définis dans `libs/shared-events/` pour garantir la cohérence entre publishers et subscribers.

| Événement | Publisher | Subscribers |
|---|---|---|
| `bet.placed` | Betting Service | Odds Engine, Wallet Service, Notification, Audit |
| `bet.won` | Betting Service | Wallet Service, Notification, Audit |
| `bet.lost` | Betting Service | Notification, Audit |
| `bet.cancelled` | Betting Service | Wallet Service, Notification, Audit |
| `event.published` | Event Service | Notification, Audit |
| `event.result_set` | Event Service | Betting Service, Notification, Audit |
| `event.cancelled` | Event Service | Betting Service, Notification, Audit |
| `payment.deposited` | Wallet Service | Notification, Audit |
| `payment.withdrawn` | Wallet Service | Notification, Audit |
| `rg.limit_updated` | User Service | Audit |
| `rg.self_excluded` | User Service | Audit |
| `user.suspended` | User Service | Audit |
| `odds.updated` | Odds Engine | (WebSocket broadcast → web + mobile) |

---

## 16. Décisions Architecturales Clés (ADR)

### ADR-001 : BullMQ + Redis plutôt que Kafka ou ActiveMQ
**Contexte** : besoin d'un event bus et de queues asynchrones.
**Décision** : BullMQ + Redis Pub/Sub.
**Raison** : Redis est déjà dans le stack pour le cache et les verrous. Kafka est surpuissant pour notre volume et nécessite une expertise opérationnelle dédiée. ActiveMQ est pensé pour Java avec un client Node.js limité et sans intégration NestJS officielle.
**Compromis** : pas de rétention longue durée des événements. Si on dépasse ~100k msg/sec, migration vers Kafka possible service par service.

### ADR-002 : 1 PostgreSQL, 4 schémas isolés plutôt que 4 instances séparées
**Contexte** : isolation des données entre services sans complexité opérationnelle.
**Décision** : un seul serveur PostgreSQL, un schéma et un user SQL par service.
**Raison** : 4 instances séparées = 4 bases à opérer, backuper, monitorer. Inutile à ce stade. L'isolation par schéma + permissions SQL interdit techniquement les accès cross-domaines.
**Compromis** : si un service doit scaler son instance DB indépendamment, extraction du schéma vers une instance dédiée possible sans toucher au code.

### ADR-003 : Pas de jointures cross-schéma
**Contexte** : récupérer des données agrégées (ex: paris d'un utilisateur avec son nom).
**Décision** : appels inter-services HTTP ou vues matérialisées Redis. Jamais de `JOIN` entre schémas.
**Raison** : préserve l'autonomie des services, les migrations isolées, et interdit le couplage silencieux.
**Compromis** : 2 appels au lieu de 1 pour les données cross-domaines. Latence négligeable (<5ms réseau interne).

### ADR-004 : Verrou Redis de 1 minute sur le recalcul des cotes
**Contexte** : deux paris simultanés peuvent provoquer une race condition sur le calcul des cotes.
**Décision** : mutex Redis (`SET NX EX 60`) par événement sportif pendant le recalcul.
**Raison** : garantit qu'un seul recalcul s'exécute à la fois par événement. Les autres workers attendent ou skippent.
**Compromis** : légère latence sur les paris très simultanés. Acceptable car le recalcul est rapide (<100ms).

### ADR-005 : Fastify plutôt qu'Express comme adaptateur HTTP
**Contexte** : choix de l'adaptateur HTTP NestJS.
**Décision** : Fastify.
**Raison** : ~2× plus performant qu'Express sur les benchmarks HTTP. Compatible NestJS nativement. Aucun changement de code applicatif nécessaire.
**Compromis** : quelques middlewares Express ne sont pas compatibles Fastify. Vérifier les dépendances tierces.

### ADR-006 : Intégrations externes mockées derrière une interface
**Contexte** : projet école — Stripe et l'API Riot ont des coûts/quotas et ne sont pas le cœur de l'apprentissage architectural.
**Décision** : abstraire chaque intégration externe derrière une interface (`IPaymentProvider`, `IGameDataProvider`) avec une implémentation mockée par défaut.
**Raison** : permet de développer et démontrer tout le flux métier sans dépendance externe, tout en gardant la possibilité de brancher le vrai service sans modifier le code appelant (principe d'inversion de dépendance).
**Compromis** : le comportement réel (latence réseau, erreurs Stripe spécifiques) n'est pas testé tant que le vrai provider n'est pas branché.

### ADR-007 : Type de pari porté par un champ JSON (`outcomes.condition`)
**Contexte** : supporter plusieurs types de paris (victoire d'équipe, durée de match, total de kills...) sans multiplier les colonnes.
**Décision** : un champ `condition` JSON sur `outcomes`, typé en discriminated union côté code.
**Raison** : flexibilité sans migration de schéma à chaque nouveau type ; le `type` discriminant pilote la logique de résolution via un `switch`.
**Compromis** : la validation de structure se fait au niveau applicatif (pas de contrainte SQL forte sur le contenu du JSON).

---

## 17. Variables d'Environnement

```env
# Base de données
DATABASE_URL=postgres://...        # DSN PostgreSQL principal

# Redis
REDIS_URL=redis://...              # cache + BullMQ + Pub/Sub

# JWT
JWT_SECRET=...                     # secret de signature des tokens
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Stripe (mocké en école — clés requises seulement pour le provider réel)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# APIs jeux (mockées en école)
RIOT_API_KEY=...
RIOT_PLATFORM=euw1
RIOT_REGION=europe
LOL_ESPORTS_API_KEY=...
```

---

## 18. Structure du Monorepo Nx

```
betnext/
├── apps/
│   │   ── CLIENTS ──
│   ├── web/                    → React 19 · Vite (joueurs)
│   ├── mobile/                 → React Native Expo (joueurs)
│   ├── admin/                  → React 19 · Vite · TanStack Table (admin/manager)
│   │
│   │   ── BACKEND ──
│   ├── api-gateway/
│   │   └── src/{auth, proxy, ws}/
│   ├── user-service/
│   │   └── src/{auth, profile, responsible-gaming, admin}/
│   ├── betting-service/
│   │   └── src/{bets, outcomes, resolution}/
│   ├── event-service/
│   │   └── src/{events, adapters, import}/
│   ├── wallet-service/
│   │   └── src/{transactions, deposit, withdrawal}/
│   ├── odds-engine/
│   │   └── src/{calculator, workers}/
│   ├── notification/
│   │   └── src/{email, realtime}/
│   └── audit-service/
│       └── src/trail/
├── libs/
│   ├── ui/                     → composants React partagés (web + admin)
│   ├── ui-native/              → composants React Native (mobile)
│   ├── shared-types/           → interfaces TypeScript partagées
│   ├── shared-events/          → événements du bus (noms + payloads)
│   └── shared-utils/           → helpers (money, dates, validation)
├── docker-compose.yml          → dev local (tous services + PG + Redis)
├── docker-compose.prod.yml     → production (replicas)
├── nx.json
├── pnpm-workspace.yaml
├── package.json
└── BETNEXT_CONTEXT.md          → CE FICHIER
```

---

## 19. Règles de Développement

### Conventions de code
- Toutes les interfaces dans `libs/shared-types/` préfixées par `I` : `IBet`, `IUser`
- Tous les événements bus dans `libs/shared-events/` suffixés par `Event` : `BetPlacedEvent`
- DTOs de validation dans chaque service, suffixés par `Dto` : `PlaceBetDto`
- Entités TypeORM suffixées par `Entity` : `BetEntity`
- Services NestJS suffixés par `Service` : `BettingService`
- Pas de `any` TypeScript — `strict: true` dans tous les `tsconfig.json`

### Règles métier non négociables
- Un pari ne peut être placé que si l'événement est en statut `PUBLIE`
- Un pari ne peut être placé après le début de l'événement (`start_date <= now()`)
- La cote est **toujours** figée au moment du pari (`locked_odds`)
- Tout crédit/débit de solde génère **obligatoirement** une transaction en DB
- Toute action sensible (pari, dépôt, modification RG, suspension) est **obligatoirement** auditée
- Les mots de passe sont **toujours** hachés avec bcrypt (jamais en clair, jamais MD5/SHA1)
- **Aucun JOIN cross-schéma** : données cross-domaines via appels inter-services ou vue Redis
- Toute intégration externe (paiement, API jeu) passe par une **interface** avec implémentation mockée

### Gestion des erreurs
- Utiliser les `BetNextErrorCode` définis — jamais de messages d'erreur libres en production
- Toujours inclure un `traceId` dans les réponses d'erreur
- Logger toutes les erreurs avec Winston (niveau `error` + contexte complet)
- Les erreurs inattendues (500) ne doivent jamais exposer de stack trace au client

---

*Fin du document de contexte BetNext.*
