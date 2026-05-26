#!/bin/sh
set -e

PORT="${PORT:-80}"
BACKEND="${BACKEND:-http://backend:4000}"
# API_URL: URL base do backend para chamadas do browser
# Produção: https://driveonback.up.railway.app/api
# Local (padrão): /api  → nginx proxia para BACKEND
API_URL="${API_URL:-/api}"

sed -i "s/__PORT__/${PORT}/g" /etc/nginx/conf.d/default.conf
sed -i "s|__BACKEND__|${BACKEND}|g" /etc/nginx/conf.d/default.conf

cat > /usr/share/nginx/html/config.js <<EOF
window.__ADMIN_CONFIG__ = {
  API_URL: "${API_URL}"
};
EOF

nginx -g "daemon off;"
