# BetNext — Découpage du projet en tâches

> Document de référence pour le développement, destiné à être fourni à Claude Code.
> Chaque tâche est numérotée, décrit ce qui est demandé, ses livrables et ses critères de fin (Definition of Done).
> Convention : on coche `[ ]` → `[x]` au fur et à mesure.
>
> **Stratégie générale** : chemin vertical d'abord. On fait fonctionner un flux de bout en bout (auth → pari) avant d'élargir aux 8 services. Les intégrations externes (Stripe, Riot) sont **mockées** derrière une interface, le vrai branchement viendra plus tard sans rien casser.

---

## Légende des features couvertes

| Feature demandée | Lots concernés |
|---|---|
| Créer un user | Lot 2, Lot 3 |
| 3 rôles (Admin tech / Gestionnaire / User) | Lot 2, Lot 8 |
| Pari (nom, description, cote, date, résultats) | Lot 4, Lot 5 |
| Plusieurs types de paris (env extensible) | Lot 4 (table `outcomes.condition` JSON) |
| « Faut que ça claque » (UX/perf) | Lot 9, Lot 10 |
| Profil (gains, data) | Lot 6, Lot 9 |
| Dashboard Admin | Lot 8 |
| Stripe comme PSP (mocké) | Lot 6 |
| Passer sur mobile facilement | Lot 1 (libs partagées), Lot 10 |
| Dissocier monitoring / audit | Lot 7, Lot 11 |
| Scaling horizontal | Lot 1, Lot 12 |

---

# LOT 0 — Cadrage & conventions

### T0.1 — Mettre en place les conventions de code
**Demandé** : définir les règles non négociables avant d'écrire la moindre ligne, pour que tout le code généré ensuite soit cohérent.

**Livrables** :
- `.editorconfig`, ESLint + Prettier configurés à la racine du monorepo
- Husky + lint-staged (hook pre-commit : lint + format sur les fichiers staged)
- `tsconfig.base.json` avec `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- Document court `CONTRIBUTING.md` rappelant les conventions de nommage : interfaces `I*`, events `*Event`, DTOs `*Dto`, entités `*Entity`, services `*Service`

**DoD** : `pnpm lint` passe sur un repo vide, le hook pre-commit bloque un commit mal formaté.

---

# LOT 1 — Fondations infrastructure (monorepo + Docker)

> Objectif : `docker compose up` et `pnpm dev` fonctionnent avant tout code métier. C'est le socle du scaling horizontal et du multi-client (web/mobile/admin).

### T1.1 — Initialiser le monorepo Nx + pnpm
**Demandé** : créer la structure de monorepo décrite dans le README, vide mais fonctionnelle.

**Livrables** :
- Monorepo Nx initialisé avec pnpm workspaces
- Arborescence `apps/` (web, mobile, admin, api-gateway, user-service, betting-service, event-service, wallet-service, odds-engine, notification, audit-service) — les dossiers peuvent être des stubs au départ
- Arborescence `libs/` (ui, ui-native, shared-types, shared-utils)
- `nx.json`, `package.json` racine, `pnpm-workspace.yaml`

**DoD** : `pnpm install` réussit, `nx graph` affiche le graphe des projets.

### T1.2 — Configurer `libs/shared-types` et `libs/shared-utils`
**Demandé** : créer les libs partagées qui porteront les types communs entre tous les services et clients. C'est la clé du « passer sur mobile facilement » : web, mobile et admin importent les mêmes types.

**Livrables** :
- `libs/shared-types` : interfaces de base (`IUser`, `IBet`, `IOutcome`, `IEvent`...), enums de rôles (`ROLE_ADMIN`, `ROLE_MANAGER`, `ROLE_USER`), enums de statuts (event lifecycle, bet status), `BetNextErrorCode`
- `libs/shared-utils` : helpers money (manipulation de décimaux sans flottants), dates, validation
- Build de chaque lib vérifié

**DoD** : un service stub peut importer `IUser` depuis `@betnext/shared-types` et compiler.

### T1.3 — Docker Compose infrastructure locale
**Demandé** : faire tourner PostgreSQL 16 et Redis 7 en local via Docker, prêts pour le développement.

**Livrables** :
- `docker-compose.yml` : services `postgres` (16) et `redis` (7) avec volumes persistants
- Script d'init PostgreSQL créant les **4 schémas** (`users`, `betting`, `events`, `wallet`) et les **4 users SQL** dédiés avec permissions limitées à leur schéma
- `.env.example` listant toutes les variables du README
- `docker-compose.prod.yml` (ébauche) avec la directive `deploy.replicas` pour montrer le scaling horizontal

**DoD** : `docker compose up -d postgres redis` démarre, on peut se connecter à chaque schéma avec son user SQL et vérifier qu'il **ne voit pas** les autres schémas.

### T1.4 — Service de health-check minimal (api-gateway)
**Demandé** : un premier service NestJS qui répond, pour valider toute la chaîne avant le métier.

**Livrables** :
- `api-gateway` en NestJS + **Fastify** (pas Express)
- Endpoint `GET /health` qui renvoie `{ status: 'ok' }`
- Helmet + ConfigModule branchés

**DoD** : `pnpm dev --filter=api-gateway` démarre, `curl localhost:3000/health` répond `ok`.

---

# LOT 2 — Authentification & rôles (user-service)

> Cœur de « créer un user » et des « 3 rôles ». Premier vrai flux métier.

### T2.1 — Entités et migrations du schéma `users`
**Demandé** : créer les tables du schéma `users` via TypeORM migrations.

**Livrables** :
- Entité `UserEntity` (`id`, `name`, `email` unique, `password_hash`, `roles`, `birth_date`, `created_at`)
- Entité `SessionEntity` (refresh tokens : `user_id`, `refresh_token_hash`, `expires_at`, `ip`, `user_agent`)
- Migrations TypeORM versionnées sur le schéma `users`
- Connexion TypeORM configurée avec le user SQL `users` uniquement

**DoD** : `pnpm db:migrate` crée les tables dans le schéma `users`, vérifiable en base.

### T2.2 — Register avec contraintes ARJEL
**Demandé** : inscription d'un utilisateur avec les règles légales obligatoires.

**Livrables** :
- Endpoint `POST /auth/register` (DTO validé via class-validator)
- Hash du mot de passe avec **bcrypt** (jamais en clair)
- **Refus si moins de 18 ans** (vérification `birth_date`) → `BetNextErrorCode.UNDERAGE`
- Email unique vérifié, rôle `ROLE_USER` par défaut
- Acceptation CGU obligatoire dans le DTO

**DoD** : un utilisateur de 17 ans est refusé avec le bon code d'erreur, un majeur est créé avec mot de passe hashé.

### T2.3 — Login + JWT (access + refresh)
**Demandé** : authentification avec tokens.

**Livrables** :
- Endpoint `POST /auth/login` : vérifie bcrypt, retourne `access_token` (15min) + `refresh_token` (7j)
- Endpoint `POST /auth/refresh` avec **rotation** du refresh token (l'ancien est invalidé)
- Passport.js + stratégies JWT
- `BetNextErrorCode.INVALID_CREDENTIALS` si échec

**DoD** : login retourne deux tokens, le refresh génère un nouveau couple et invalide l'ancien.

### T2.4 — Vérification JWT centralisée à l'API Gateway
**Demandé** : conformément au README, **seul** l'API Gateway vérifie le JWT ; les services internes font confiance aux headers injectés.

**Livrables** :
- Guard JWT dans l'api-gateway qui valide le token et injecte `userId` + `roles` dans les headers internes
- Décorateur `@Roles(...)` + guard de rôles réutilisable
- Les services internes lisent `userId`/`roles` depuis les headers, sans re-vérifier le token

**DoD** : une requête sans token valide est rejetée au gateway (401), une route `@Roles(ROLE_ADMIN)` est inaccessible à un `ROLE_USER` (403).

---

# LOT 3 — Données de référence & seed

### T3.1 — Migrations des schémas `events`, `betting`, `wallet`
**Demandé** : créer toutes les tables restantes du diagramme de BDD, schéma par schéma.

**Livrables** :
- Schéma `events` : `games`, `tournaments`, `e_sport_events`, `teams`, `event_teams`, `outcomes`
- Schéma `betting` : `bets`, `bets_history`
- Schéma `wallet` : `transactions`, `balances`
- Entités TypeORM correspondantes + migrations
- Respect du modèle : `outcomes.condition` en JSON, `outcomes.event_player_id` **nullable**, `bets.locked_odds`, `bets_history` append-only

**DoD** : `pnpm db:migrate` crée toutes les tables dans les bons schémas.

### T3.2 — Script de seed (comptes démo + données e-sport)
**Demandé** : charger les comptes de démonstration et des données réalistes pour tester.

**Livrables** :
- `pnpm db:seed` crée les 7 comptes du README (admin, manager, 5 users), mot de passe `password`
- Données e-sport : 1 jeu (LoL), 1-2 tournois, quelques équipes (T1, GenG, G2, BLG...), 2-3 événements avec leurs `event_teams` et `outcomes`
- Soldes initiaux dans `wallet.balances`

**DoD** : après seed, on peut se logger avec `faker@betnext.gg` / `password` et voir des événements existants.

---

# LOT 4 — Événements & game adapters (event-service)

> Couvre « le gestionnaire crée les événements » et « plusieurs types de paris ».

### T4.1 — Interface `IGameDataProvider` + adapter mocké
**Demandé** : poser l'interface commune des adapters et un premier adapter **mocké** (pas d'appel réseau réel pour l'instant).

**Livrables** :
- Interface `IGameDataProvider` dans `shared-types` (`getAdapterType`, `fetchLiveEvents`, `fetchEventResult`, `mapToSportEvent`)
- `MockLolAdapter` qui retourne 2-3 événements LoL en dur, conformes à l'interface
- Enregistrement via injection NestJS (le service découvre les adapters automatiquement)

**DoD** : l'event-service peut appeler `fetchLiveEvents()` sur le mock et obtenir des événements typés.

### T4.2 — CRUD événements (ROLE_MANAGER)
**Demandé** : permettre au gestionnaire de créer/modifier/gérer les événements et leur cycle de vie.

**Livrables** :
- Endpoints CRUD événements protégés `@Roles(ROLE_MANAGER)`
- Cycle de vie respecté : `BROUILLON → PUBLIE → FERME → TERMINE`, et `BROUILLON/PUBLIE → ANNULE`
- Règles : suppression interdite hors BROUILLON, paris ouverts uniquement en PUBLIE
- Gestion des `teams` et `event_teams` (N équipes par événement)

**DoD** : un manager crée un événement en BROUILLON, le publie, et ne peut plus le supprimer une fois publié.

### T4.3 — Création des outcomes typés (plusieurs types de paris)
**Demandé** : permettre de créer différents types de paris via le champ `condition` JSON, et concevoir le code pour que de nouveaux types s'ajoutent sans refonte.

**Livrables** :
- Type TypeScript `OutcomeCondition` en discriminated union (`TEAM_WINS`, `MATCH_DURATION`, `TOTAL_KILLS`...) dans `shared-types`
- Endpoint de création d'outcomes qui valide la structure `condition` selon son `type`
- Parsing/validation côté code du JSON `condition`
- Documentation des types de conditions supportés

**DoD** : on peut créer un outcome « Team A gagne » (lié à un `event_player_id`) ET un outcome « match < 20 min » (`event_player_id` null, `condition` JSON), tous deux persistés correctement.

### T4.4 — Saisie des résultats & résolution des événements
**Demandé** : permettre au manager de saisir le résultat, ce qui déclenche la résolution.

**Livrables** :
- Endpoint de saisie de résultat (passage en TERMINE)
- Mise à jour des `outcomes.is_winner` et `event_teams.final_rank`
- Émission de l'événement `event.result_set` sur le bus (voir Lot 7)
- Logique de résolution par `type` d'outcome (`switch` sur `condition.type`)

**DoD** : un manager saisit le résultat d'un événement, les outcomes gagnants sont marqués, l'événement passe en TERMINE.

---

# LOT 5 — Paris & cotes (betting-service + odds-engine)

> Le cœur fonctionnel : « Pari (nom, description, cote, date, résultats) ».

### T5.1 — Placement d'un pari (flux vertical complet)
**Demandé** : permettre à un user de placer un pari, avec toutes les vérifications synchrones.

**Livrables** :
- Endpoint `POST /bets` (DTO validé)
- Vérifications **synchrones** avant placement :
  - événement en statut PUBLIE et `start_date > now()` → sinon `EVENT_NOT_PUBLISHED` / `EVENT_ALREADY_STARTED`
  - appel sync user-service : limites jeu responsable OK
  - appel sync wallet-service : solde suffisant → sinon `INSUFFICIENT_BALANCE`
- **Cote figée** dans `bets.locked_odds` au moment du pari
- Persistance du pari en statut PENDING
- Émission `bet.placed` sur le bus (voir Lot 7)

**DoD** : un user place un pari valide, refusé si solde insuffisant / événement fermé / limite RG atteinte, chacun avec le bon `BetNextErrorCode`.

### T5.2 — Moteur de cotes + verrou Redis (odds-engine)
**Demandé** : recalculer les cotes de façon asynchrone et sûre face à la concurrence.

**Livrables** :
- `odds-engine` en consommateur BullMQ de `bet.placed`
- Formule : `cote = total misé événement / total misé issue`, bornes **[1.10 – 5.00]**, défaut **1.50**
- **Verrou Redis** `SET NX EX 60` par événement pendant le recalcul
- Émission `odds.updated` après recalcul

**DoD** : placer plusieurs paris simultanés sur un même événement ne produit pas de cotes incohérentes (le verrou empêche les recalculs concurrents).

### T5.3 — Résolution des paris (gains/pertes)
**Demandé** : calculer les gains quand un événement est résolu.

**Livrables** :
- Consommateur de `event.result_set` dans betting-service
- Passage des paris en WON / LOST selon `outcomes.is_winner`
- Calcul du gain (`amount × locked_odds`) pour les paris gagnants
- Émission `bet.won` / `bet.lost`
- Écriture dans `bets_history` (append-only)

**DoD** : après résolution d'un événement, les paris gagnants passent WON avec gain calculé, les perdants LOST, l'historique est tracé.

### T5.4 — Historique des paris
**Demandé** : exposer l'historique des paris d'un utilisateur.

**Livrables** :
- Endpoint listant les paris d'un user avec leur statut et gain éventuel
- Assemblage des données cross-domaines (pari + info événement) **sans JOIN cross-schéma** : appels inter-services ou vue matérialisée Redis

**DoD** : un user voit la liste de ses paris avec statut, montant, cote figée et gain.

---

# LOT 6 — Portefeuille & paiement mocké (wallet-service)

> « Stripe comme PSP » mais **mocké** pour le contexte scolaire. « Profil → gains, data » s'appuie là-dessus.

### T6.1 — Soldes et transactions
**Demandé** : gérer le solde de chaque user, source de vérité, avec traçabilité obligatoire.

**Livrables** :
- `wallet.balances` comme source de vérité du solde
- **Toute** opération de crédit/débit génère **obligatoirement** une ligne `wallet.transactions`
- Consommateur de `bet.placed` (débit) et `bet.won` (crédit)
- Endpoint de consultation du solde + historique des transactions

**DoD** : placer un pari débite le solde et crée une transaction ; gagner crédite le solde et crée une transaction.

### T6.2 — Provider de paiement mocké (interface Stripe)
**Demandé** : abstraire le PSP derrière une interface, avec une implémentation mockée — pour pouvoir brancher le vrai Stripe plus tard sans toucher au reste.

**Livrables** :
- Interface `IPaymentProvider` (`createPaymentIntent`, `confirmPayment`, `handleWebhook`...)
- `MockStripeProvider` : simule la création d'un PaymentIntent et un webhook `payment_intent.succeeded` sans réseau
- Idempotence : un `stripe_id` déjà traité n'est pas rejoué
- Structure prête à recevoir un `RealStripeProvider` (clés dans les variables d'env)

**DoD** : un dépôt mocké crédite le solde via le faux webhook, un rejeu du même event est ignoré (idempotent).

### T6.3 — Dépôt & retrait (avec contrôles RG)
**Demandé** : flux de dépôt et de retrait, soumis aux limites jeu responsable.

**Livrables** :
- Endpoint dépôt → crée un PaymentIntent (mocké) → crédite sur webhook
- Endpoint retrait → vérifie solde disponible + limites RG → transaction PENDING puis COMPLETED
- Émission `payment.deposited` / `payment.withdrawn`
- Limites de dépôt quotidiennes/hebdomadaires respectées → `DEPOSIT_LIMIT_REACHED`

**DoD** : un user dépose (solde crédité), retire (solde débité si suffisant), une limite de dépôt dépassée est refusée.

---

# LOT 7 — Event bus & jeu responsable

> Introduit l'asynchrone une fois que plusieurs services ont une vraie raison de se parler.

### T7.1 — Mise en place de l'event bus (Redis Pub/Sub + BullMQ)
**Demandé** : câbler le bus d'événements inter-services et les files de jobs.

**Livrables** :
- `libs/shared-events` : définition typée de tous les événements (`BetPlacedEvent`, `BetWonEvent`, `EventPublishedEvent`, `PaymentDepositedEvent`, `RgLimitUpdatedEvent`, `OddsUpdatedEvent`...)
- Wrapper de publication/souscription Redis Pub/Sub réutilisable
- Configuration BullMQ (queues, workers, retry exponentiel)
- Dashboard BullMQ accessible en dev

**DoD** : un service publie `bet.placed`, un autre le reçoit ; un job BullMQ qui échoue est rejoué selon la politique de retry.

### T7.2 — Jeu responsable complet (user-service)
**Demandé** : implémenter toutes les règles ARJEL de protection du joueur.

**Livrables** :
- Entité `rg_profiles` (limites mise/dépôt quotidiennes/hebdomadaires, `self_excluded_until`)
- **Règle des 48h** : diminuer une limite = immédiat ; augmenter = effet après 48h (`LIMIT_INCREASE_PENDING`)
- **Auto-exclusion** : bloque la **connexion** (pas seulement les paris), non annulable avant la fin
- Émission `rg.limit_updated` / `rg.self_excluded`
- Endpoints de gestion des limites pour le user

**DoD** : augmenter une limite ne prend effet qu'après 48h ; un user auto-exclu ne peut plus se connecter.

### T7.3 — Résilience des services
**Demandé** : garantir qu'une panne d'un service non critique ne bloque pas le flux principal.

**Livrables** :
- Si notification down → le pari est quand même placé (non bloquant)
- Si odds-engine down → cotes à la dernière valeur connue (cache Redis)
- Si paiement (mock) down → mise en queue BullMQ avec retry
- Pas de propagation en cascade : chaque service gère ses erreurs

**DoD** : couper le notification-service ne bloque pas le placement d'un pari.

---

# LOT 8 — Dashboard Admin & gestion (admin)

> « Dashboard Admin » + gestion utilisateurs + rôle gestionnaire.

### T8.1 — SPA admin (React + Vite) avec accès restreint
**Demandé** : créer l'interface interne, accessible uniquement aux rôles internes.

**Livrables** :
- App `admin` : React 19 + Vite + TanStack Table + React Query
- Login + garde d'accès `ROLE_ADMIN` / `ROLE_MANAGER`
- Layout, navigation, consommation de `libs/ui`

**DoD** : un `ROLE_USER` ne peut pas accéder à l'admin, un manager/admin oui.

### T8.2 — Dashboard KPI (admin tech)
**Demandé** : tableau de bord avec les indicateurs clés de la plateforme.

**Livrables** :
- Vue KPI : volume de paris, volume financier misé, utilisateurs actifs, nombre d'événements par statut
- Graphiques (courbes/barres) alimentés par les données agrégées
- Données cross-domaines assemblées sans JOIN cross-schéma

**DoD** : le dashboard affiche des KPI cohérents avec les données seedées.

### T8.3 — Gestion des utilisateurs (ROLE_ADMIN)
**Demandé** : permettre à l'admin de gérer les comptes.

**Livrables** :
- Liste des utilisateurs (TanStack Table : tri, filtre, pagination)
- **Suspension** d'un compte (bloque la connexion immédiatement) → émission `user.suspended`
- Consultation des profils RG (limites, auto-exclusion)

**DoD** : un admin suspend un compte, l'utilisateur concerné ne peut plus se connecter.

### T8.4 — Gestion des événements & import (ROLE_MANAGER)
**Demandé** : interface de création/gestion d'événements pour les gestionnaires.

**Livrables** :
- Formulaires de création/édition d'événements et d'outcomes (réutilise Lot 4)
- Déclenchement de l'import depuis l'adapter mocké (`fetchLiveEvents`)
- Saisie des résultats

**DoD** : un manager crée un événement complet (équipes + outcomes) depuis l'UI et saisit son résultat.

---

# LOT 9 — Front joueurs Web (web)

> « Faut que ça claque » + « Profil (gains, data) ».

### T9.1 — SPA web joueurs (React + Vite)
**Demandé** : l'application principale des parieurs.

**Livrables** :
- App `web` : React 19 + Vite + Zustand (état global : user, solde, cotes live) + React Query
- Auth (register/login/refresh), routing public + protégé `ROLE_USER`
- Consommation de `libs/ui` (composants, Tailwind, design tokens)

**DoD** : un user s'inscrit, se connecte, et accède à son espace.

### T9.2 — Catalogue d'événements & placement de pari
**Demandé** : parcourir les événements et parier, avec une UX soignée.

**Livrables** :
- Liste des événements PUBLIE avec leurs outcomes et cotes
- Tunnel de placement de pari (sélection outcome, montant, confirmation)
- Gestion des erreurs métier affichées proprement (cote changée, solde insuffisant...)

**DoD** : un user place un pari depuis l'UI et voit son solde mis à jour.

### T9.3 — Cotes live en WebSocket
**Demandé** : afficher les cotes en temps réel — l'effet « ça claque ».

**Livrables** :
- Client Socket.io connecté au gateway
- Réception des `odds.updated` et mise à jour live de l'affichage des cotes
- Réception des notifications (pari gagné/perdu, résultat d'événement)

**DoD** : placer un pari sur un événement met à jour les cotes affichées chez un autre user connecté, sans rechargement.

### T9.4 — Profil joueur (gains & data)
**Demandé** : page profil avec les gains et les données de l'utilisateur.

**Livrables** :
- Affichage : solde, historique des paris (statut, gain), historique des transactions
- Statistiques personnelles : total misé, total gagné, taux de réussite
- Graphiques (Recharts) d'évolution des gains
- Gestion des limites jeu responsable + auto-exclusion depuis le profil

**DoD** : un user consulte ses gains, son historique et configure ses limites RG.

---

# LOT 10 — Front joueurs Mobile (mobile)

> « Passer sur mobile facilement » : on réutilise un maximum la logique partagée.

### T10.1 — App mobile (React Native / Expo)
**Demandé** : l'app mobile joueurs, partageant les types et la logique métier du web.

**Livrables** :
- App `mobile` : React Native (Expo) + Zustand + React Query
- `libs/ui-native` (NativeWind) avec les **mêmes design tokens** que `libs/ui`
- Réutilisation de `shared-types` (mêmes contrats que le web → effort minimal)
- Auth + catalogue + placement de pari + profil (parité fonctionnelle avec web)

**DoD** : l'app mobile permet de se connecter, parier et consulter son profil.

### T10.2 — Notifications push & cotes live mobile
**Demandé** : temps réel et push sur mobile.

**Livrables** :
- Socket.io client pour les cotes live
- Notifications push (Expo notifications) sur les événements clés (pari résolu, résultat)

**DoD** : un user mobile reçoit une notification push quand son pari est résolu.

---

# LOT 11 — Observabilité (monitoring + audit dissociés)

> « Dissocier traçabilité en deux : monitoring et audit ». Distinction explicite demandée.

### T11.1 — Audit ARJEL (audit-service)
**Demandé** : traçabilité réglementaire immuable, **distincte** du monitoring technique.

**Livrables** :
- `audit-service` consommateur du bus (tous les événements sensibles : `bet.placed`, `payment.*`, `rg.*`, `user.suspended`...)
- Table PostgreSQL **append-only** : jamais de UPDATE/DELETE
- Rétention longue (5 ans, conformité légale)
- Vérification qu'aucune route ne permet de modifier/supprimer une ligne d'audit

**DoD** : chaque action sensible crée une ligne d'audit immuable ; aucune opération ne peut l'altérer.

### T11.2 — Monitoring technique (Prometheus + Grafana)
**Demandé** : supervision technique temps réel, **distincte** de l'audit.

**Livrables** :
- prom-client dans chaque service exposant les métriques : `betnext_bets_total`, `betnext_bet_amount_sum`, `betnext_odds_calculation_duration_ms`, `betnext_active_users_gauge`, `betnext_rg_limit_hits_total`
- Prometheus configuré pour scraper les services
- Dashboards Grafana (latence, volume, erreurs)

**DoD** : Grafana affiche les métriques en temps réel ; un pic de paris se voit sur le dashboard.

### T11.3 — Logs structurés (Winston + Loki)
**Demandé** : logs JSON centralisés et recherchables.

**Livrables** :
- Winston configuré en JSON structuré dans chaque service (`timestamp`, `level`, `service`, `traceId`, `userId`, `message`...)
- Agrégation vers Loki
- `traceId` propagé dans les réponses d'erreur, jamais de stack trace exposée au client en prod

**DoD** : une erreur est tracée avec son contexte complet dans Loki et retournée au client avec un `traceId` mais sans stack trace.

---

# LOT 12 — Scaling horizontal & finalisation

> « Scaling horizontal » : démontrer que l'archi tient la charge.

### T12.1 — Préparer le scaling des services stateless
**Demandé** : rendre les services réplicables et le démontrer.

**Livrables** :
- `docker-compose.prod.yml` avec `deploy.replicas` (ex : betting-service ×3, odds-engine ×2)
- nginx en reverse proxy / load balancer devant l'api-gateway
- Vérification que les services métier sont bien stateless

**DoD** : lancer plusieurs réplicas d'un service et constater la répartition de charge via nginx.

### T12.2 — Cohérence Redis en multi-instance
**Demandé** : garantir que verrous, WebSocket et sessions restent cohérents quand les services sont répliqués.

**Livrables** :
- Socket.io avec Redis adapter (rooms partagées entre instances)
- Verrou de cotes vérifié en contexte multi-instance
- (Optionnel/documenté) Redis Sentinel ou Cluster pour la prod

**DoD** : avec 2 instances d'api-gateway, un broadcast WebSocket atteint les clients connectés sur les deux.

### T12.3 — CI/CD GitHub Actions
**Demandé** : pipeline d'intégration continue.

**Livrables** :
- Workflow GitHub Actions : `lint → test → build` sur chaque push/PR
- Tests Jest (unitaires) + Supertest (e2e) exécutés en CI
- Build des images Docker

**DoD** : une PR déclenche le pipeline ; un test cassé bloque le merge.

### T12.4 — Documentation API (Swagger)
**Demandé** : documentation auto-générée des endpoints.

**Livrables** :
- Swagger / OpenAPI activé sur chaque service exposant des routes
- Documentation accessible en dev

**DoD** : la doc Swagger liste tous les endpoints avec leurs DTOs.

---

## Ordre de réalisation conseillé

```
Lot 0 → Lot 1 → Lot 2 → Lot 3 → Lot 4 → Lot 5 → Lot 6 → Lot 7
                                                            ↓
                            Lot 8 (admin) ┐
                            Lot 9 (web)   ├─ en parallèle une fois le backend stable
                            Lot 10 (mobile)┘
                                                            ↓
                                              Lot 11 → Lot 12
```

**Jalons de démonstration** :
- **Jalon 1** (fin Lot 5) : un user peut s'inscrire, se connecter, et placer un pari de bout en bout sur des données mockées.
- **Jalon 2** (fin Lot 9) : plateforme web complète, parier + profil + cotes live.
- **Jalon 3** (fin Lot 12) : multi-client (web/mobile/admin), observable, scalable.

---

## Notes pour Claude Code

- **Toujours** consulter `BETNEXT_CONTEXT.md` pour le détail technique avant d'implémenter un lot.
- TypeScript strict partout, zéro `any`. Valider tous les inputs avec class-validator + DTOs.
- Respecter l'isolation des schémas : **aucun JOIN cross-schéma**, données cross-domaines via appels inter-services ou vue matérialisée Redis.
- Toute intégration externe (Stripe, Riot) passe par une interface avec une implémentation mockée d'abord.
- Procéder lot par lot, en validant la DoD de chaque tâche avant de passer à la suivante.
- Écrire les tests au fur et à mesure (Jest unitaire + Supertest e2e), pas à la fin.
