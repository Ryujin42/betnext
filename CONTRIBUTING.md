# Contribuer à BetNext

> Ce document rappelle les conventions **non négociables** du projet. Le détail
> technique complet vit dans [`BETNEXT_CONTEXT.md`](./BETNEXT_CONTEXT.md) et le
> découpage du travail dans [`BETNEXT_TASKS.md`](./BETNEXT_TASKS.md).

## Outillage

- **Node.js >= 20**, **pnpm >= 9** (jamais npm ni yarn).
- Monorepo **Nx + pnpm workspaces**.
- **TypeScript strict partout** : `strict: true`, zéro `any` (`@typescript-eslint/no-explicit-any` est en `error`).

## Conventions de nommage

| Élément | Convention | Exemple | Emplacement |
| --- | --- | --- | --- |
| Interface | préfixe `I` | `IBet`, `IUser`, `IPaymentProvider` | `libs/shared-types` |
| Événement du bus | suffixe `Event` | `BetPlacedEvent`, `OddsUpdatedEvent` | `libs/shared-events` |
| DTO de validation | suffixe `Dto` | `PlaceBetDto`, `RegisterDto` | dans chaque service |
| Entité TypeORM | suffixe `Entity` | `BetEntity`, `UserEntity` | dans chaque service |
| Service NestJS | suffixe `Service` | `BettingService` | dans chaque service |

## Règles d'architecture

- **4 schémas PostgreSQL isolés** (`users`, `betting`, `events`, `wallet`), 1 user SQL par schéma. **Aucun `JOIN` cross-schéma** : les données cross-domaine passent par des appels inter-services ou une vue matérialisée Redis.
- **Fastify** comme adaptateur HTTP NestJS (jamais Express).
- Seul l'**API Gateway** vérifie le JWT ; les services internes font confiance aux headers `userId` / `roles` injectés.
- Toute intégration externe (Stripe, Riot) passe par une **interface** avec une implémentation **mockée** d'abord.
- Toute action sensible (pari, dépôt, modification RG, suspension) est **auditée** (table append-only).
- Les mots de passe sont **toujours** hachés avec **bcrypt**.

## Workflow Git

Le projet avance **lot par lot**. Chaque lot du [`BETNEXT_TASKS.md`](./BETNEXT_TASKS.md) est développé sur sa propre branche, puis fusionné sur `main` une fois sa **Definition of Done** validée.

### Modèle de branches

- `main` — branche stable et protégée. Chaque merge correspond à un lot validé (les jalons de démo sont des états de `main`). **Jamais de commit direct sur `main`.**
- Branches de travail : `<type>/lot-<N>-<slug>`
  - `chore/lot-0-conventions`
  - `feat/lot-1-foundations`
  - `feat/lot-2-auth`
  - …
- Les correctifs ponctuels suivent la même règle : `fix/<slug>`.

### Cycle de vie d'un lot

```
git switch -c feat/lot-1-foundations    # partir de main à jour
# … implémentation, commits atomiques …
pnpm lint                                # doit passer avant de pousser
git push -u origin feat/lot-1-foundations
# Ouvrir une Pull Request vers main, vérifier la DoD, puis merge
```

### Convention de commits — Conventional Commits

Format : `<type>(<scope>): <sujet>` (impératif, minuscule, sans point final).

```
feat(api-gateway): ajoute le endpoint GET /health
fix(odds-engine): borne la cote à 5.00 maximum
chore(lot-0): met en place ESLint, Prettier et Husky
docs(readme): complète la section variables d'environnement
```

| Type | Usage |
| --- | --- |
| `feat` | nouvelle fonctionnalité |
| `fix` | correction de bug |
| `docs` | documentation seule |
| `refactor` | refonte sans changement de comportement |
| `test` | ajout/correction de tests |
| `chore` | outillage, config, dépendances |
| `ci` | pipeline d'intégration continue |
| `perf` / `style` / `build` / `revert` | voir Conventional Commits |

Le `scope` est libre : nom du service/lib (`api-gateway`, `shared-types`) ou `lot-N`.

### Hooks Git (Husky) — automatiques

- **pre-commit** → `lint-staged` : ESLint `--fix` puis Prettier sur les fichiers *staged*. Un fichier non conforme (ex. un `any`) **bloque le commit**.
- **commit-msg** → `commitlint` : un message ne respectant pas la convention **bloque le commit**.

Ces deux garde-fous tournent localement à chaque `git commit`, sans action manuelle.

## Commandes utiles

```bash
pnpm install          # installer les dépendances du workspace
pnpm lint             # linter tout le monorepo
pnpm format           # formater tout le code avec Prettier
pnpm format:check     # vérifier le formatage sans modifier
```
