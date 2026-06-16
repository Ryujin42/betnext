#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# Initialisation PostgreSQL : 1 schéma applicatif unique (`betnext`) et un
# user applicatif dédié non-superuser (`betnext_app`).
#
# Toutes les tables de tous les domaines (users, bets, events, wallet) vivent
# dans ce schéma unique → les JOIN entre domaines sont autorisés.
#
# Exécuté automatiquement par l'image postgres au premier démarrage
# (volume vide), via /docker-entrypoint-initdb.d.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- User applicatif (non-superuser)
  CREATE USER betnext_app WITH PASSWORD '${APP_DB_PASSWORD}';

  -- Schéma applicatif unique, possédé par le user applicatif
  CREATE SCHEMA betnext AUTHORIZATION betnext_app;

  -- search_path par défaut = le schéma applicatif
  ALTER ROLE betnext_app SET search_path = betnext;

  -- Personne ne crée dans le schéma public
  REVOKE ALL ON SCHEMA public FROM PUBLIC;
EOSQL

echo "[init] schéma 'betnext' + user applicatif 'betnext_app' créés."
