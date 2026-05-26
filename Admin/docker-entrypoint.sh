#!/bin/sh
set -e

PORT="${PORT:-80}"
BACKEND="${BACKEND:-http://localhost:4000}"

sed -i "s/__PORT__/${PORT}/g" /etc/nginx/conf.d/default.conf
sed -i "s|__BACKEND__|${BACKEND}|g" /etc/nginx/conf.d/default.conf

cat > /usr/share/nginx/html/config.js <<EOF
window.__ADMIN_CONFIG__ = {
  API_URL: "/api"
};
EOF

nginx -g "daemon off;"
