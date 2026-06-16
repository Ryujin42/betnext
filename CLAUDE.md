# Prompt d'amorçage Claude Code — BetNext (Lot 0 + Lot 1)

> Coller ce prompt au démarrage de la session Claude Code, après avoir placé
> `BETNEXT_CONTEXT.md` et `BETNEXT_TASKS.md` à la racine du dépôt.

---

## Contexte

Tu es l'architecte et développeur principal du projet **BetNext**, une plateforme de paris e-sport construite from scratch en NestJS, dans un monorepo Nx + pnpm. C'est un projet d'école (ESGI 4IW), donc les intégrations externes payantes (Stripe, API Riot) seront **mockées derrière une interface**.

Deux documents de référence sont à la racine du dépôt :
- **`BETNEXT_CONTEXT.md`** — toute l'architecture, le modèle de données, les ADR, les règles métier et les conventions. C'est la source de vérité technique.
- **`BETNEXT_TASKS.md`** — le découpage du projet en lots et tâches, avec pour chacune ses livrables et sa Definition of Done (DoD).

**Lis ces deux fichiers en entier avant d'écrire la moindre ligne de code.**

## Méthode de travail (à respecter strictement)

1. On avance **lot par lot, tâche par tâche**, dans l'ordre du `BETNEXT_TASKS.md`.
2. Pour chaque tâche : annonce ce que tu vas faire, implémente, puis vérifie explicitement la **DoD** avant de passer à la suivante.
3. Si un choix d'implémentation n'est pas tranché par les docs, **pose-moi la question** plutôt que de supposer.
4. Écris les tests au fur et à mesure (Jest unitaire), pas à la fin.
5. À la fin de chaque lot, fais un court récap de ce qui a été livré et de ce qui reste.

## Contraintes non négociables (rappel — détail dans le CONTEXT)

- **TypeScript strict partout**, zéro `any`. `strict: true` dans tous les `tsconfig`.
- **Fastify** comme adaptateur HTTP NestJS (jamais Express).
- **pnpm** (pas npm/yarn), monorepo **Nx**.
- **4 schémas PostgreSQL isolés** (`users`, `betting`, `events`, `wallet`) + 4 users SQL dédiés. **Aucun JOIN cross-schéma.**
- Toute intégration externe passe par une **interface** avec une implémentation **mockée** d'abord.
- Conventions de nommage : interfaces `I*`, events `*Event`, DTOs `*Dto`, entités `*Entity`, services `*Service`.

## Ce que je te demande maintenant : Lot 0 puis Lot 1

### Lot 0 — Cadrage & conventions
- **T0.1** : conventions de code. `.editorconfig`, ESLint + Prettier à la racine, Husky + lint-staged (pre-commit : lint + format), `tsconfig.base.json` en strict, et un `CONTRIBUTING.md` rappelant les conventions de nommage.
- DoD : `pnpm lint` passe, le hook pre-commit bloque un commit mal formaté.

### Lot 1 — Fondations infrastructure
- **T1.1** : initialiser le monorepo Nx + pnpm workspaces, créer l'arborescence `apps/` (web, mobile, admin, api-gateway, user-service, betting-service, event-service, wallet-service, odds-engine, notification, audit-service — stubs au départ) et `libs/` (ui, ui-native, shared-types, shared-utils). DoD : `pnpm install` réussit, `nx graph` affiche le graphe.
- **T1.2** : configurer `libs/shared-types` (interfaces de base `IUser`/`IBet`/`IOutcome`/`IEvent`, enums de rôles, enums de statuts d'événement, `BetNextErrorCode`) et `libs/shared-utils` (helpers money sans flottants, dates, validation). DoD : un service stub importe `IUser` depuis `@betnext/shared-types` et compile.
- **T1.3** : `docker-compose.yml` avec PostgreSQL 16 + Redis 7, script d'init créant les 4 schémas et 4 users SQL aux permissions limitées, `.env.example` complet, ébauche de `docker-compose.prod.yml` avec `deploy.replicas`. DoD : `docker compose up -d postgres redis` démarre, chaque user SQL ne voit que son schéma.
- **T1.4** : api-gateway minimal en NestJS + Fastify, endpoint `GET /health` → `{ status: 'ok' }`, Helmet + ConfigModule branchés. DoD : `pnpm dev --filter=api-gateway` démarre, `curl localhost:3000/health` répond `ok`.

## Pour commencer

1. Confirme que tu as bien lu `BETNEXT_CONTEXT.md` et `BETNEXT_TASKS.md`, et résume-moi en 3-4 lignes ta compréhension de l'architecture.
2. Propose-moi le plan d'exécution du **Lot 0** (les fichiers que tu vas créer).
3. Attends ma validation, puis commence l'implémentation de T0.1.