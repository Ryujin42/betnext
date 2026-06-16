#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Vérifie l'isolation des 4 schémas PostgreSQL (DoD T1.3) :
#   - chaque user SQL a USAGE sur SON schéma
#   - et n'a AUCUN accès aux 3 autres
#   - une création cross-schéma est refusée
#
# Usage (postgres doit tourner via `docker compose up -d postgres`) :
#   bash infra/postgres/verify-isolation.sh
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/../.."

DB="${POSTGRES_DB:-betnext}"
SCHEMAS=(users betting events wallet)
declare -A PASS=([users_svc]="${USERS_DB_PASSWORD:-users_pwd}" [betting_svc]="${BETTING_DB_PASSWORD:-betting_pwd}" [events_svc]="${EVENTS_DB_PASSWORD:-events_pwd}" [wallet_svc]="${WALLET_DB_PASSWORD:-wallet_pwd}")
declare -A OWN=([users_svc]=users [betting_svc]=betting [events_svc]=events [wallet_svc]=wallet)
fail=0

# Exécute une requête SQL en tant que $1 (mot de passe $2) et renvoie la sortie.
q() { docker compose exec -T -e PGPASSWORD="$2" postgres psql -tAq -U "$1" -d "$DB" -c "$3" 2>&1; }

for user in users_svc betting_svc events_svc wallet_svc; do
  for schema in "${SCHEMAS[@]}"; do
    res="$(q "$user" "${PASS[$user]}" "SELECT has_schema_privilege('$user','$schema','USAGE');")"
    if [ "$schema" = "${OWN[$user]}" ]; then
      [ "$res" = "t" ] && echo "OK   $user -> USAGE $schema" || { echo "KO   $user devrait avoir USAGE sur $schema (reçu: '$res')"; fail=1; }
    else
      [ "$res" = "f" ] && echo "OK   $user  -/-  $schema (isolé)" || { echo "KO   $user NE devrait PAS voir $schema (reçu: '$res')"; fail=1; }
    fi
  done
done

echo "--- tentative de création cross-schéma (doit échouer) ---"
out="$(q betting_svc "${PASS[betting_svc]}" "CREATE TABLE users.hack(x int);")"
if [[ "$out" == *"permission denied"* ]]; then
  echo "OK   betting_svc ne peut pas créer dans le schéma users"
else
  echo "KO   betting_svc a pu accéder au schéma users (reçu: '$out')"; fail=1
fi

echo "--- création dans son propre schéma (doit réussir) ---"
out="$(q betting_svc "${PASS[betting_svc]}" "CREATE TABLE IF NOT EXISTS betting.smoke(x int); DROP TABLE betting.smoke;")"
if [[ "$out" == *ERROR* ]]; then
  echo "KO   betting_svc ne peut pas écrire dans son schéma betting (reçu: '$out')"; fail=1
else
  echo "OK   betting_svc peut écrire dans son schéma betting"
fi

if [ "$fail" = "0" ]; then echo "=== ISOLATION OK ==="; else echo "=== ISOLATION ÉCHOUÉE ==="; exit 1; fi
