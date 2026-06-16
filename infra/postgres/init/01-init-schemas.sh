#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# Initialisation PostgreSQL : 1 instance, 4 schémas isolés, 4 users SQL.
# Chaque user est PROPRIÉTAIRE de son schéma (AUTHORIZATION) et n'a aucun
# accès aux autres schémas → l'isolation est garantie au niveau SQL
# (impossible de faire un JOIN cross-schéma, cf. ADR-002 / ADR-003).
#
# Exécuté automatiquement par l'image postgres au premier démarrage
# (volume vide), via /docker-entrypoint-initdb.d.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- 1 user SQL par service
  CREATE USER users_svc   WITH PASSWORD '${USERS_DB_PASSWORD}';
  CREATE USER betting_svc WITH PASSWORD '${BETTING_DB_PASSWORD}';
  CREATE USER events_svc  WITH PASSWORD '${EVENTS_DB_PASSWORD}';
  CREATE USER wallet_svc  WITH PASSWORD '${WALLET_DB_PASSWORD}';

  -- 1 schéma par service, possédé par le user correspondant
  CREATE SCHEMA users   AUTHORIZATION users_svc;
  CREATE SCHEMA betting AUTHORIZATION betting_svc;
  CREATE SCHEMA events  AUTHORIZATION events_svc;
  CREATE SCHEMA wallet  AUTHORIZATION wallet_svc;

  -- search_path par défaut = le schéma du service
  ALTER ROLE users_svc   SET search_path = users;
  ALTER ROLE betting_svc SET search_path = betting;
  ALTER ROLE events_svc  SET search_path = events;
  ALTER ROLE wallet_svc  SET search_path = wallet;

  -- Verrouillage : personne ne crée dans le schéma public
  REVOKE ALL ON SCHEMA public FROM PUBLIC;
EOSQL

echo "[init] 4 schémas isolés + 4 users SQL créés."
