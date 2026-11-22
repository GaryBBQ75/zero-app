#!/bin/sh
set -e
cd /pb
# Compte administrateur créé ou mis à jour depuis les variables Coolify (jamais écrit dans le code)
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  ./pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir=/pb/pb_data >/dev/null
fi
exec ./pocketbase serve --http=0.0.0.0:8090 --dir=/pb/pb_data --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks
