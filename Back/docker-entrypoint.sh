#!/bin/sh
set -e

npx prisma migrate deploy --schema prisma/schema.prisma

if [ "${RUN_SEED_ADMIN:-false}" = "true" ]; then
  npm run seed:admin
fi

if [ "${RUN_SEED_SISTEMA:-false}" = "true" ]; then
  node scripts/create-sistema-user.mjs
fi

node dist/index.js
