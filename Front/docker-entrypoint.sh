#!/bin/sh
set -e

PORT="${PORT:-80}"
BACKEND="${BACKEND:-http://api:4000}"
sed -i "s/__PORT__/${PORT}/g" /etc/nginx/conf.d/default.conf
sed -i "s|__BACKEND__|${BACKEND}|g" /etc/nginx/conf.d/default.conf

cat > /usr/share/nginx/html/config.js <<EOF
window.__DRIVEON_CONFIG__ = {
  API_URL: "${API_URL:-/api}",
  TURNSTILE_SITE_KEY: "${TURNSTILE_SITE_KEY:-1x00000000000000000000AA}"
};
EOF

nginx -g "daemon off;"
