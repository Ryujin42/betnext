# BetNext — Cahier de tests fonctionnels (Lots 0 → 10)

> Document destiné à valider que chaque fonctionnalité demandée dans `BETNEXT_TASKS.md` est réellement présente et conforme à `BETNEXT_CONTEXT.md`.
> Lots **11** (observabilité) et **12** (scaling) sont volontairement exclus (en cours côté binôme).
>
> Chaque test = un scénario que l'on peut exécuter à la main (curl/Postman/UI) ou automatiser (Jest + Supertest). Convention : `[ ]` → `[x]` une fois validé.

---

## Légende statuts (à reporter en fin de doc une fois exécuté)

- ✅ Passe
- ❌ Échoue → renvoie au bug correspondant dans §99
- 🟡 Partiel / contournement

---

# LOT 1 — Infrastructure

### T1.A — Démarrage de l'infra locale
- [ ] `docker compose up -d postgres redis` démarre les conteneurs sains.
- [ ] `psql` avec `betnext_app` accède au schéma `betnext`, mais NE peut PAS créer un schéma (non-superuser).
- [ ] `pnpm install` s'exécute sans erreur, `pnpm nx graph` affiche les apps + libs.
- [ ] `pnpm dev:back` démarre les 7 services et expose les ports 3000-3006.
- [ ] `GET http://localhost:3000/health` → `{ "status": "ok" }`.
- [ ] Chaque service interne expose `GET /health` (3001-3005).

### T1.B — Libs partagées
- [ ] `import { IUser } from '@betnext/shared-types'` compile depuis n'importe quel service.
- [ ] `toCents(0.1 + 0.2) === 30` (pas d'erreur de flottant).

---

# LOT 2 — Auth & rôles (user-service)

### T2.A — Register ARJEL
- [ ] `POST /auth/register` avec `birthDate` rendant l'utilisateur < 18 ans → `403 AUTH_005` (`UNDERAGE`).
- [ ] Mot de passe < 12 caractères → `400` avec détail dans `details.issues`.
- [ ] Mot de passe sans majuscule → `400`.
- [ ] `acceptTos: false` (ou absent) → `400`.
- [ ] Email déjà existant → `409 GEN_001` "Un compte existe déjà".
- [ ] Email avec casse mixte (`Alice@X.fr`) puis ré-inscription en minuscule → `409` (unicité normalisée).
- [ ] Payload valide → `201`, `password_hash` en BDD commence par `$argon2id$`.
- [ ] Le rôle par défaut est `ROLE_USER` (jamais un tableau).

### T2.B — Login
- [ ] `POST /auth/login` avec mauvais mot de passe → `401 AUTH_001` "Identifiants invalides".
- [ ] Email inconnu → **même** code/message qu'un mauvais mot de passe (anti-énumération).
- [ ] Compte suspendu (`suspended_at` non null) → `403 AUTH_003`.
- [ ] Compte auto-exclu (`self_excluded_until` futur) → `403 AUTH_004`.
- [ ] Login OK → réponse contient `accessToken`, `refreshToken`, `expiresIn=300`, `refreshExpiresAt`, `user`.
- [ ] `accessToken` décodé : `sub`, `role`, `type=access`, `exp - iat = 300`.
- [ ] Une ligne est créée dans `sessions` avec `ip`, `user_agent`, `family_id`.

### T2.C — Refresh + rotation
- [ ] `POST /auth/refresh` avec refresh valide → nouveau couple access+refresh, **ancien refresh révoqué** (`revoked_at` non null).
- [ ] Réutiliser un refresh déjà révoqué → toutes les sessions de la même `family_id` deviennent `revoked_at != null` et la réponse est `401 AUTH_001`.
- [ ] Refresh expiré (> 7j) → `401`.
- [ ] Le nouveau refresh appartient à la **même** `family_id`.

### T2.D — JWT centralisé au gateway
- [ ] Route protégée appelée **sans** Authorization → `401`.
- [ ] Route `@Roles(ROLE_ADMIN)` appelée avec un token ROLE_USER → `403`.
- [ ] Un service interne (`user-service` direct sur 3001) NE re-vérifie PAS le JWT (lit les headers `x-user-id` / `x-user-role`).

---

# LOT 3 — Schéma & seed

### T3.A — Migrations
- [ ] `pnpm db:migrate` crée toutes les tables dans le schéma `betnext` : `users`, `sessions`, `rg_profiles`, `games`, `tournaments`, `e_sport_events`, `teams`, `event_teams`, `outcomes`, `bets`, `bets_history`, `transactions`, `balances`.
- [ ] `outcomes.event_player_id` est **nullable**.
- [ ] `bets.locked_odds` est `decimal NOT NULL`.
- [ ] FK cross-domaines présentes (ex: `bets.user_id → users.id`).
- [ ] `pnpm db:migrate:revert` → re-run = idempotent.

### T3.B — Seed
- [ ] `pnpm db:seed` crée 7 comptes (`admin`, `manager`, `faker`, `t1`, `geng`, `g2`, `blg` `@betnext-v2.gg`), mot de passe `password`.
- [ ] Login `faker@betnext-v2.gg` / `password` réussit.
- [ ] Au moins 2 événements en statut `PUBLIE` avec ≥ 3 outcomes chacun.
- [ ] Les soldes initiaux sont présents dans `balances`.

---

# LOT 4 — Événements (event-service)

### T4.A — CRUD & cycle de vie
- [ ] `ROLE_USER` tente `POST /events` → `403`.
- [ ] `ROLE_MANAGER` crée un event → statut initial `BROUILLON`.
- [ ] Suppression d'un event `PUBLIE` → `409`.
- [ ] Suppression d'un event `BROUILLON` → `204`.
- [ ] Transition `BROUILLON → PUBLIE` ok ; `BROUILLON → TERMINE` rejetée ; `PUBLIE → FERME` ok ; `TERMINE → ANNULE` rejetée.
- [ ] **🔴 `PUBLIE → ANNULE`** : autorisé ET les paris associés (statut `PENDING`) sont remboursés et passent en `CANCELLED`. Voir §99 Bug #2 — actuellement KO.

### T4.B — Outcomes typés (`condition` JSON)
- [ ] Création outcome `TEAM_WINS` avec `event_player_id` renseigné → OK.
- [ ] Création outcome `MATCH_DURATION` (`{type, operator, minutes}`) avec `event_player_id = null` → OK.
- [ ] `condition` mal formé (clé manquante, type inconnu) → `400`.
- [ ] Persistence : `condition` est bien lu en JSON typé (round-trip create → read).

### T4.C — Saisie de résultat
- [ ] Manager saisit le résultat d'un event `PUBLIE`/`FERME` → event passe en `TERMINE`, `outcomes.is_winner` mis à jour selon `decideOutcomeWinner`.
- [ ] Émission `event.result_set` sur le bus (vérifier via journaux betting-service).
- [ ] Saisie d'un résultat sur un event `BROUILLON` → `409`.

---

# LOT 5 — Paris & cotes (betting-service + odds-engine)

### T5.A — Placement (chemin nominal)
- [ ] `POST /bets` avec `outcomeId` valide, event `PUBLIE`, solde suffisant, hors limites → `201`, retourne le pari créé.
- [ ] `bets.locked_odds` = la cote au moment du pari (figée, indépendante des recalculs ultérieurs).
- [ ] Une ligne est créée dans `bets_history` (`old_status=null`, `new_status=PENDING`).
- [ ] Solde débité **exactement** du montant misé.

### T5.B — Placement (refus)
- [ ] Event `BROUILLON`/`FERME`/`TERMINE`/`ANNULE` → `422 BET_001` (`EVENT_NOT_PUBLISHED`).
- [ ] Event `PUBLIE` mais `start_date <= now` → `422 BET_002` (`EVENT_ALREADY_STARTED`).
- [ ] Solde insuffisant → `422 BET_003` (`INSUFFICIENT_BALANCE`).
- [ ] Limite journalière de mise atteinte → `422 BET_004`.
- [ ] Limite hebdomadaire atteinte → `422 BET_005`.
- [ ] **🔴 Auto-exclusion active** (token encore valide) → le pari doit être refusé. Voir §99 Bug #4.
- [ ] **🔴 Compte suspendu** (token encore valide) → le pari doit être refusé. Voir §99 Bug #4.

### T5.C — Double-débit (PRIORITÉ HAUTE — bug remonté)
- [ ] Placer 1 pari de 5 € : `transactions` contient **exactement UNE** ligne `BET` de 5 €. Voir §99 Bug #1 (actuellement KO en `EVENT_BUS_DRIVER=redis`).
- [ ] Le solde est débité exactement de 5 € (pas 10 €).

### T5.D — Moteur de cotes (T5.2)
- [ ] Placer un pari déclenche la souscription `bet.placed` → recalcul des cotes de toutes les issues du même event.
- [ ] Cotes bornées dans `[1.10, 5.00]`, défaut `1.50` quand pas de mise.
- [ ] Émission `odds.updated` après recalcul (visible dans les logs odds-engine).
- [ ] **Test de concurrence** : 5 placements simultanés sur le même event → un seul recalcul actif à la fois (verrou Redis `odds:event:<id>` TTL 60s).

### T5.E — Résolution des paris
- [ ] Saisir le résultat d'un event → paris gagnants passent en `WON`, perdants en `LOST`.
- [ ] Gain crédité = `amount × locked_odds` (arrondi au centime).
- [ ] Ligne ajoutée dans `bets_history` pour chaque pari résolu.
- [ ] `bet.won` / `bet.lost` publiés sur le bus.
- [ ] **🔴 Double-crédit symétrique** : un pari gagné doit créer **UNE seule** transaction `WIN`. Voir §99 Bug #1 bis.

### T5.F — Historique
- [ ] `GET /bets/me` retourne les paris de l'utilisateur avec `event`, `outcomeLabel`, `lockedOdds`, `status`, `potentialGain`, `actualGain`.
- [ ] `actualGain` est `null` pour PENDING, `0` pour LOST, `amount × locked_odds` pour WON.
- [ ] `GET /bets/:id` d'un pari d'un autre user → `404` (jamais `200`).

---

# LOT 6 — Wallet & paiement mocké

### T6.A — Soldes & traçabilité
- [ ] `GET /wallet/balance` retourne le solde courant.
- [ ] `GET /wallet/transactions` liste les opérations par `createdAt DESC`.
- [ ] **Toute** opération de crédit/débit a une ligne dans `transactions` (vérifier sur dépôt, retrait, mise, gain).

### T6.B — Dépôt (mock)
- [ ] `POST /wallet/deposit { amount: 50 }` → solde +50, 1 transaction `DEPOSIT` `COMPLETED` avec `stripe_id` non null.
- [ ] **Rejouer** le même webhook (même `paymentIntentId`) → aucune nouvelle ligne (idempotence sur `stripe_id`).
- [ ] Limite quotidienne `RG_DAILY_DEPOSIT_LIMIT` dépassée → `422 WAL_001`.
- [ ] Limite individuelle `rg_profiles.daily_deposit_limit` (si définie) prime sur la limite plateforme.
- [ ] **🔴 Double-débit dépôt** (cas remonté) : dépôt 5 € → vérifier qu'il n'y a **pas** 2 lignes de débit liées. Voir §99 Bug #1 (la cause technique est la même).

### T6.C — Retrait
- [ ] `POST /wallet/withdraw` avec montant > solde → `422 WAL_003` (`INSUFFICIENT_FUNDS`).
- [ ] Retrait valide → 1 transaction `WITHDRAWAL` `PENDING` puis `COMPLETED`, solde débité.
- [ ] Émission `payment.withdrawn` sur le bus.
- [ ] **🔴 Retrait pendant auto-exclusion** : doit être refusé (cf. ADR / contexte) — pas implémenté aujourd'hui. Voir §99 Bug #5.

### T6.D — Interface PSP
- [ ] `PAYMENT_PROVIDER=mock` (défaut) → `MockStripeProvider` injecté.
- [ ] `PAYMENT_PROVIDER=real` → `RealStripeProvider` injecté (sans clé valide, l'app démarre quand même : le contrôle se fait au runtime du dépôt).

---

# LOT 7 — Event bus & RG complet

### T7.A — Bus
- [ ] `EVENT_BUS_DRIVER=in-memory` → bus interne, OK mono-process.
- [ ] `EVENT_BUS_DRIVER=redis` → un `publish` côté betting-service est reçu côté wallet-service ET odds-engine.
- [ ] Dashboard BullMQ accessible sur `http://localhost:3000/admin/queues` quand `BULLBOARD_ENABLED=true`.
- [ ] Un job qui jette → retry exponentiel (au moins 2 retries observables).

### T7.B — RG : règle des 48h
- [ ] `PATCH /me/rg/limits` qui **baisse** une limite → effet immédiat (colonne `daily_bet_limit` mise à jour, `pending_*` à null).
- [ ] `PATCH` qui **hausse** une limite → la valeur courante reste inchangée, `pending_daily_bet_limit` reçoit la nouvelle valeur, `pending_effective_at = now + 48h`, événement `rg.limit_updated` `effect=pending`.
- [ ] Une seconde hausse pendant qu'une hausse est encore en attente → `409 RG_001` (`LIMIT_INCREASE_PENDING`).
- [ ] Après le délai (simuler en avançant `pending_effective_at` en BDD), un `GET /me/rg` promeut la valeur et expose la nouvelle limite courante.
- [ ] La promotion est lue par betting-service ET wallet-service au moment des contrôles (JOIN sur `rg_profiles`).

### T7.C — RG : auto-exclusion
- [ ] `POST /me/rg/self-exclude { durationDays: 30 }` → `selfExcludedUntil` = now + 30j, `rg.self_excluded` publié.
- [ ] Une nouvelle auto-exclusion qui raccourcit la date → ignorée (date d'origine conservée).
- [ ] Une auto-exclusion qui allonge → date mise à jour.
- [ ] Login refusé pendant la fenêtre (cf. T2.B).
- [ ] **🔴** Pari/dépôt/retrait pendant la fenêtre avec un token déjà émis : doivent être refusés au gateway ou dans chaque service. Voir §99 Bug #4 / #5.

### T7.D — Résilience
- [ ] Couper le notification-service → un `POST /bets` retourne quand même `201` (notification non bloquante).
- [ ] Couper l'odds-engine → les cotes affichées tombent en fallback cache (`getLastKnownOdds`).
- [ ] Couper le wallet-service → un dépôt n'échoue pas immédiatement, le webhook est mis en queue BullMQ et retraité au redémarrage.

---

# LOT 8 — Admin (web admin SPA)

### T8.A — Accès
- [ ] Login `faker@betnext-v2.gg` (ROLE_USER) sur `http://localhost:5174` → accès refusé (redirect ou écran d'erreur).
- [ ] Login `admin@…` → dashboard accessible.
- [ ] Login `manager@…` → accès aux écrans events uniquement (pas la gestion users).

### T8.B — KPIs
- [ ] La page dashboard affiche : nombre de paris par statut, volume total misé (€), utilisateurs actifs, nombre d'events par statut.
- [ ] Les chiffres correspondent à `SELECT COUNT/SUM` direct en BDD.
- [ ] Graphiques (recharts ou équivalent) présents et non vides quand il y a des données.

### T8.C — Gestion utilisateurs
- [ ] Liste paginée + tri + filtre (TanStack Table).
- [ ] `POST /admin/users/:id/suspend` avec un manager → `403`.
- [ ] Suspension admin : `suspended_at` rempli, `user.suspended` publié, l'utilisateur ne peut plus se logger.
- [ ] Réactivation : `suspended_at` revient à null.
- [ ] Vue d'un user : ses limites RG, son auto-exclusion, son solde.

### T8.D — Gestion événements & outcomes
- [ ] Manager crée un event complet depuis l'UI (équipes + outcomes typés).
- [ ] Bouton "Importer depuis adapter mocké" → ajoute des events `BROUILLON`.
- [ ] Saisie de résultat depuis l'UI déclenche la résolution des paris (vérifier dans `bets_history`).

---

# LOT 9 — Web joueurs

### T9.A — Auth & shell
- [ ] Inscription depuis l'UI : formulaire respecte les contraintes (mot de passe fort, CGU obligatoire, > 18 ans), erreurs affichées proprement.
- [ ] Login depuis l'UI → redirection vers l'espace joueur, solde et nom dans le header.
- [ ] **Intercepteur fetch-and-retry** : laisser le token expirer (5 min), faire une action → l'app rejoue après refresh, sans déconnecter.
- [ ] Refresh révoqué → déconnexion propre + retour login.
- [ ] Tenter d'accéder à une route protégée sans token → redirige sur login.

### T9.B — Catalogue & placement
- [ ] La home liste les events `PUBLIE` triés par `start_date`.
- [ ] Cliquer un event → outcomes avec leurs cotes ; on peut sélectionner un outcome.
- [ ] Tunnel : sélection → saisie montant → confirmation → succès, solde mis à jour.
- [ ] Erreur métier (cote changée, solde insuffisant, limite RG) → message explicite, pas un toast générique `500`.

### T9.C — Cotes live (WebSocket)
- [ ] Ouvrir 2 navigateurs sur un même event, l'un place un pari → l'autre voit la cote mise à jour sans rafraîchir.
- [ ] Réception d'un `bet.resolved` (pari gagné/perdu) → notification visible côté UI.

### T9.D — Profil
- [ ] Page profil : solde, historique des paris (statut, cote figée, gain), historique des transactions.
- [ ] Stats : total misé, total gagné, taux de réussite — cohérents avec les données.
- [ ] Graphique d'évolution des gains (Recharts) présent.
- [ ] Section RG : baisse de limite immédiate, hausse en attente 48h, bouton auto-exclusion (avec confirmation forte).

---

# LOT 10 — Mobile

### T10.A — App mobile (Expo)
- [ ] Démarrage Expo sans erreur.
- [ ] Mêmes contrats d'API que le web (types depuis `@betnext/shared-types`).
- [ ] Parité fonctionnelle : login, catalogue, placement, profil.
- [ ] Design tokens partagés (`libs/ui-native` ↔ `libs/ui`).

### T10.B — Live & push
- [ ] Socket.io client reçoit les `odds.updated`.
- [ ] Notification push reçue à la résolution d'un pari.

---

# §99 — BUGS IDENTIFIÉS PENDANT L'AUDIT — À PATCHER

## 🔴 Bug #1 — Double-débit / double-crédit dès que `EVENT_BUS_DRIVER=redis`

**Symptôme** : "j'ai misé 5 € et j'ai été débité 2 fois" (et idem pour un gain).

**Cause racine** :
- `apps/betting-service/src/bets/bets.service.ts:78` — `placeBet()` débite **synchrone** via `LocalWalletService.debit()`, écrit balance + transaction.
- `apps/betting-service/src/bets/bets.service.ts:104` — publie `bet.placed` sur le bus.
- `apps/wallet-service/src/wallet/bet-events.subscriber.ts:30` — abonné à `bet.placed`, appelle `WalletService.debitForBet()` qui **re-débite et re-écrit une transaction**.
- Avec `EVENT_BUS_DRIVER=in-memory`, le subscriber est dans un autre process → ne reçoit jamais l'événement. Avec `redis` (cas de la `.env` actuelle), il le reçoit → **2 mouvements**.
- Le commentaire du subscriber (`bet-events.subscriber.ts:14-21`) prévient explicitement le problème.

Idem côté gains :
- `apps/betting-service/src/bets/bet-resolution.service.ts:90` — crédit synchrone direct + publie `bet.won`.
- `apps/wallet-service/src/wallet/bet-events.subscriber.ts:33` — re-crédite via `creditForWin()`.

**Patch recommandé** (au choix, à trancher avant impl) :

> **Option A — désactiver le subscriber** (le plus simple, statu quo Lot 6) : retirer `BetEventsSubscriber` des providers du `WalletModule`. Le débit/crédit reste 100 % synchrone côté betting-service (qui écrit dans la même BDD, même schéma `betnext`). Conserver le subscriber commenté pour mémoire.

> **Option B — bascule complète "consumer wallet seule source"** (cible Lot 7) : retirer `wallet.debit()` et `wallet.credit()` de `BetsService.placeBet` et `BetResolutionService.resolveForEvent`. **Mais** : il faut alors poser une transaction `betting + wallet` cohérente (outbox pattern minimum), sinon une coupure entre commit du pari et délivrance du bus laisse le pari sans débit. À mon sens trop gros pour ce sprint.

→ **Recommandation : Option A** maintenant, Option B documentée pour quand le Lot 7 sera vraiment livré.

---

## 🔴 Bug #2 — Annulation d'event ne rembourse pas les paris

**Symptôme** : "si le match est annulé par un gestionnaire alors les joueurs ne sont pas remboursés".

**Cause racine** :
- `apps/event-service/src/events/events.controller.ts:96-99` — `POST /events/:id/cancel` appelle juste `events.transition(id, ANNULE)`.
- `apps/event-service/src/events/events.service.ts:83-90` — `transition()` ne fait que changer le statut. **Aucune** émission d'événement `event.cancelled`, **aucun** appel betting-service.
- `BETNEXT_CONTEXT.md:487` impose pourtant : `ANNULE → Paris remboursés`.
- Aucun consommateur `event.cancelled` n'existe dans betting-service (`grep` à blanc).

**Patch à implémenter** :

1. Ajouter `EventCancelledEvent` dans `libs/shared-events/src/events.ts` + topic `BetNextTopic.EventCancelled = 'event.cancelled'`.
2. Dans `EventsService.transition` (ou dans un wrapper `cancel()` dédié) : après commit du `ANNULE`, publier `EventCancelledEvent { eSportEventId, occurredAt }`.
3. Côté betting-service, créer un consumer (sur le même modèle que `BetResolutionProducer`) qui, sur `event.cancelled` :
    - charge tous les paris `PENDING` rattachés (via JOIN outcomes → eSportEventId),
    - dans une transaction : passe chaque pari en `CANCELLED`, écrit `bets_history` (`reason: 'Événement annulé'`), rembourse le solde via `wallet.credit(manager, userId, amount, TransactionType.REFUND, ...)`.
4. Ajouter `TransactionType.REFUND` dans `shared-types` s'il n'existe pas (à vérifier).
5. Idempotence : utiliser le `jobId = event-cancel-<id>` pour empêcher un double-remboursement si le bus rejoue.
6. Tests à ajouter : T4.A ligne « 🔴 PUBLIE → ANNULE » + un test de résolution doit prouver l'idempotence du refund.

---

## 🟠 Bug #3 — Pari/dépôt/retrait avec token valide après suspension OU auto-exclusion

**Symptôme attendu (à vérifier)** : un utilisateur loggé depuis < 5 min, qui est suspendu ou s'auto-exclut, peut continuer à placer des paris / retirer pendant la fenêtre du token.

**Cause racine** :
- `apps/api-gateway/src/auth/jwt.strategy.ts` ne fait que vérifier la signature. Aucune ré-interrogation du user-service.
- `BetsService.placeBet` ne consulte pas `isSelfExcluded` ni `suspendedAt`.
- `WalletService.withdraw` non plus.

**Patch recommandé** :
- Ajouter dans `BetsService.placeBet` (et `WalletService.withdraw`) un appel à `RgProfilesService.isSelfExcluded(userId)` + lecture `users.suspended_at`. Refus → `403 AUTH_004` / `AUTH_003`.
- Alternative plus robuste : un guard gateway qui appelle un endpoint léger `GET /internal/users/:id/status` du user-service (à cacher Redis 30s).

Acceptation : un user auto-exclu avec un token frais ne peut RIEN faire de plus que consulter (lecture).

---

## 🟠 Bug #4 — Retrait non bloqué pendant auto-exclusion

Inclus dans Bug #3 mais à distinguer : la jurisprudence ARJEL exige que pendant l'auto-exclusion, l'utilisateur ne peut **ni jouer ni retirer**. Le retrait doit être pris en charge par le support, pas par un endpoint libre.

**Patch** :
- Dans `WalletService.withdraw`, refus si `selfExcludedUntil > now`. Code `AUTH_004` ou variante wallet (à arbitrer).

---

## 🟠 Bug #5 — Aucun audit immuable côté betting/wallet/rg

**Symptôme attendu** : `BETNEXT_CONTEXT.md` §11 (« audit ARJEL ») et T11.1 demandent une table `audit_*` append-only pour toutes les actions sensibles. Aujourd'hui : seul `bets_history` existe (et porte mal son nom — c'est un historique de statuts, pas un audit ARJEL).

**Statut** : prévu Lot 11 → **ne pas patcher maintenant**, juste documenter qu'il manque. À garder en tête : `audit_rg`, `audit_payments`, `audit_bets` (append-only, jamais UPDATE/DELETE, rétention 5 ans).

---

## 🟡 Bug #6 — `MOCK_LOL` adapter non câblé à l'UI admin

À vérifier au moment du test T8.D : si l'écran admin n'a pas le bouton "Importer", on est partiellement KO sur T4.A & T4.1 DoD.

---

## 🟡 Bug #7 — `RG_WEEKLY_DEPOSIT_LIMIT` non listée dans `.env.example`

`apps/wallet-service/src/wallet/deposit-limits.service.ts:12` — défaut hardcodé à 5000. Mais le `.env.example` ne mentionne que `RG_DAILY_DEPOSIT_LIMIT`. Petit fix doc à faire.

---

# §100 — Ordre suggéré pour patcher

1. **Bug #1** (double-débit) — bloquant pour toute démo. Option A : ~10 lignes dans `apps/wallet-service/src/wallet/wallet.module.ts` (retirer le subscriber) + un test e2e dans `betting-service` qui pose un pari et compte les transactions.
2. **Bug #2** (refund sur annulation) — un sprint d'une demi-journée, à faire avant la démo joueurs.
3. **Bug #3 + #4** (token valide vs suspension/exclusion) — à boucler avant la soutenance.
4. **Bug #7** — fix éclair de doc.
5. **Bug #5 + #6** — relèvent du Lot 11 et de la finalisation Lot 8 — ne pas inclure dans le patch maintenant.

---

# §101 — Matrice de couverture par DoD

| DoD | Test couvrant | Statut estimé |
|---|---|---|
| T2.2 — 17 ans refusé, majeur créé | T2.A | ✅ |
| T2.3 — refresh rotatif | T2.C | ✅ |
| T2.4 — gateway seul valide JWT | T2.D | ✅ |
| T4.2 — cycle de vie respecté | T4.A | 🟡 (annulation incomplète — Bug #2) |
| T4.4 — résultat → résolution | T5.E | ⚠️ (Bug #1 bis si redis bus) |
| T5.1 — pari valide + refus motivés | T5.B | 🟡 (Bug #3/#4 manquants) |
| T5.2 — verrou Redis cotes | T5.D | ✅ |
| T5.3 — gains calculés | T5.E | ⚠️ (Bug #1 bis) |
| T6.1 — trace obligatoire | T6.A | ✅ |
| T6.2 — idempotence dépôt | T6.B | ✅ |
| T6.3 — limites de dépôt | T6.B | ✅ |
| T7.2 — 48h + auto-exclusion | T7.B / T7.C | 🟡 (login OK mais session déjà ouverte non bloquée — Bug #3) |
| T7.3 — résilience | T7.D | À tester manuellement |
| T8.3 — suspension bloque login | T2.B / T8.C | 🟡 (idem Bug #3) |
| T9.x — UI player | T9.* | à dérouler |
| T10.x — UI mobile | T10.* | à dérouler |
