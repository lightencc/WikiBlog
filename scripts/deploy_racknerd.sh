#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"

append_env() {
  local key="$1"
  local value="$2"
  printf '%s=%q\n' "${key}" "${value}" >>"${ENV_FILE}"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

usage() {
  cat <<'EOF'
Usage:
  VPS_HOST=1.2.3.4 DOMAIN=example.com ./scripts/deploy_racknerd.sh

Required environment variables:
  VPS_HOST                Remote server IP or hostname
  DOMAIN                  Primary domain name, e.g. example.com

Optional environment variables:
  VPS_USER                SSH user, default: root
  VPS_PORT                SSH port, default: 22
  APP_NAME                App/service name, default: wikiblog
  APP_DIR                 Remote app directory, default: /var/www/wikiblog
  APP_PORT                Local Node.js listen port on VPS, default: 4321
  NODE_MAJOR              Node.js major version to install, default: 22
  SITE_NAME               Site name for production env
  SITE_DESCRIPTION        Site description for production env
  SITE_OWNER              Site owner for production env
  SOCIAL_X                Social X URL
  SOCIAL_GITHUB           Social GitHub URL
  OPENCLAW_API_KEY        Optional API key for POST /api/v1/articles
  OBSIDIAN_VAULT_PATH     Optional remote path to Obsidian vault
  OBSIDIAN_ROOT_PATH      Optional remote Obsidian root path
  CERTBOT_EMAIL           Email for Let's Encrypt. If set, certbot will run.
  ENABLE_SSL              true/false, default: true
  CLOUDFLARE_MODE         proxied/dns_only, default: dns_only
  DEPLOY_MODE             detached/attached, default: detached
  SSH_SERVER_ALIVE_INTERVAL  SSH keepalive interval, default: 15
  SSH_SERVER_ALIVE_COUNT_MAX SSH keepalive retries, default: 6
  SSH_PASSWORD            Optional password for non-interactive ssh/scp via sshpass
  SSH_IDENTITY_FILE       Optional private key path for ssh/scp

Examples:
  VPS_HOST=203.0.113.10 DOMAIN=blog.example.com CERTBOT_EMAIL=ops@example.com \
  ./scripts/deploy_racknerd.sh

  VPS_HOST=203.0.113.10 DOMAIN=example.com VPS_USER=deploy APP_DIR=/srv/wikiblog \
  ENABLE_SSL=false ./scripts/deploy_racknerd.sh
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_command ssh
require_command scp
require_command tar
require_command mktemp

VPS_HOST="${VPS_HOST:-}"
DOMAIN="${DOMAIN:-}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
APP_NAME="${APP_NAME:-wikiblog}"
APP_DIR="${APP_DIR:-/var/www/${APP_NAME}}"
APP_PORT="${APP_PORT:-4321}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SITE_NAME="${SITE_NAME:-OpenClaw Reading}"
SITE_DESCRIPTION="${SITE_DESCRIPTION:-AI driven personal reading site}"
SITE_OWNER="${SITE_OWNER:-Ella}"
SOCIAL_X="${SOCIAL_X:-https://x.com/}"
SOCIAL_GITHUB="${SOCIAL_GITHUB:-https://github.com/}"
OPENCLAW_API_KEY="${OPENCLAW_API_KEY:-}"
OBSIDIAN_VAULT_PATH="${OBSIDIAN_VAULT_PATH:-}"
OBSIDIAN_ROOT_PATH="${OBSIDIAN_ROOT_PATH:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
ENABLE_SSL="${ENABLE_SSL:-true}"
CLOUDFLARE_MODE="${CLOUDFLARE_MODE:-dns_only}"
DOMAIN_ALIASES="${DOMAIN_ALIASES:-}"
DEPLOY_MODE="${DEPLOY_MODE:-detached}"
SSH_SERVER_ALIVE_INTERVAL="${SSH_SERVER_ALIVE_INTERVAL:-15}"
SSH_SERVER_ALIVE_COUNT_MAX="${SSH_SERVER_ALIVE_COUNT_MAX:-6}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-}"

if [[ -z "${VPS_HOST}" || -z "${DOMAIN}" ]]; then
  usage
  exit 1
fi

if [[ "${ENABLE_SSL}" == "true" && -n "${CERTBOT_EMAIL}" && "${CLOUDFLARE_MODE}" != "dns_only" ]]; then
  echo "CERTBOT_EMAIL is set, but CLOUDFLARE_MODE=${CLOUDFLARE_MODE}." >&2
  echo "Use dns_only while issuing Let's Encrypt certificates, then switch Cloudflare to proxied." >&2
  exit 1
fi

SSH_TARGET="${VPS_USER}@${VPS_HOST}"
SSH_OPTIONS=(
  -o "ServerAliveInterval=${SSH_SERVER_ALIVE_INTERVAL}"
  -o "ServerAliveCountMax=${SSH_SERVER_ALIVE_COUNT_MAX}"
  -o "TCPKeepAlive=yes"
)

if [[ -n "${SSH_IDENTITY_FILE}" ]]; then
  SSH_OPTIONS+=(-i "${SSH_IDENTITY_FILE}")
fi
SSH_CMD=(ssh "${SSH_OPTIONS[@]}" -p "${VPS_PORT}")
SCP_CMD=(scp "${SSH_OPTIONS[@]}" -P "${VPS_PORT}")

if [[ -n "${SSH_PASSWORD}" ]]; then
  require_command sshpass
  SSH_CMD=(sshpass -p "${SSH_PASSWORD}" "${SSH_CMD[@]}")
  SCP_CMD=(sshpass -p "${SSH_PASSWORD}" "${SCP_CMD[@]}")
fi

TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="${TMP_DIR}/${APP_NAME}-${RELEASE_ID}.tar.gz"
REMOTE_ARCHIVE="/tmp/${APP_NAME}-${RELEASE_ID}.tar.gz"
ENV_FILE="${TMP_DIR}/production.env"
REMOTE_SCRIPT_FILE="${TMP_DIR}/${APP_NAME}-${RELEASE_ID}-remote.sh"
REMOTE_SCRIPT_PATH="/tmp/${APP_NAME}-${RELEASE_ID}-remote.sh"
REMOTE_LOG_PATH="/var/log/${APP_NAME}-deploy-${RELEASE_ID}.log"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

>"${ENV_FILE}"
append_env PORT "${APP_PORT}"
append_env SITE_NAME "${SITE_NAME}"
append_env SITE_DESCRIPTION "${SITE_DESCRIPTION}"
append_env SITE_OWNER "${SITE_OWNER}"
append_env SOCIAL_X "${SOCIAL_X}"
append_env SOCIAL_GITHUB "${SOCIAL_GITHUB}"

if [[ -n "${OPENCLAW_API_KEY}" ]]; then
  append_env OPENCLAW_API_KEY "${OPENCLAW_API_KEY}"
fi

if [[ -n "${OBSIDIAN_VAULT_PATH}" ]]; then
  append_env OBSIDIAN_VAULT_PATH "${OBSIDIAN_VAULT_PATH}"
fi

if [[ -n "${OBSIDIAN_ROOT_PATH}" ]]; then
  append_env OBSIDIAN_ROOT_PATH "${OBSIDIAN_ROOT_PATH}"
fi

cat >"${REMOTE_SCRIPT_FILE}" <<'REMOTE_SCRIPT'
#!/usr/bin/env bash

set -euo pipefail

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "This script must run as root on the VPS." >&2
    exit 1
  fi
}

install_packages() {
  export DEBIAN_FRONTEND=noninteractive

  apt-get update
  apt-get install -y ca-certificates curl gnupg nginx

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" != "${NODE_MAJOR}" ]]; then
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" | \
      gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo \
      "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
      >/etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get install -y nodejs
  fi

  if [[ "${ENABLE_SSL}" == "true" && -n "${CERTBOT_EMAIL}" ]]; then
    apt-get install -y certbot python3-certbot-nginx
  fi
}

deploy_release() {
  local releases_dir current_dir release_dir

  releases_dir="${APP_DIR}/releases"
  current_dir="${APP_DIR}/current"
  release_dir="${releases_dir}/${RELEASE_ID}"

  mkdir -p "${releases_dir}" "${APP_DIR}/shared/content/posts"
  mkdir -p "${release_dir}"
  tar -xzf "${REMOTE_ARCHIVE}" -C "${release_dir}" --strip-components=0

  cp /tmp/production.env "${release_dir}/.env.production"
  mkdir -p "${release_dir}/content"
  rm -rf "${release_dir}/content/posts"
  ln -s "${APP_DIR}/shared/content/posts" "${release_dir}/content/posts"

  cd "${release_dir}"
  npm ci --omit=dev

  ln -sfn "${release_dir}" "${current_dir}"
}

write_systemd_service() {
  cat >/etc/systemd/system/${APP_NAME}.service <<EOF
[Unit]
Description=${APP_NAME} web service
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/current
EnvironmentFile=${APP_DIR}/current/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "${APP_NAME}"
  systemctl restart "${APP_NAME}"
}

write_nginx_site() {
  local server_names

  server_names="${DOMAIN}"
  if [[ -n "${DOMAIN_ALIASES}" ]]; then
    server_names="${server_names} ${DOMAIN_ALIASES}"
  fi

  cat >/etc/nginx/sites-available/${APP_NAME} <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_names};

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

  ln -sfn "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable nginx
  systemctl restart nginx
}

issue_certificate() {
  local certbot_args

  certbot_args=(-d "${DOMAIN}")
  if [[ -n "${DOMAIN_ALIASES}" ]]; then
    read -r -a alias_array <<<"${DOMAIN_ALIASES}"
    for alias in "${alias_array[@]}"; do
      certbot_args+=(-d "${alias}")
    done
  fi

  certbot --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    -m "${CERTBOT_EMAIL}" \
    "${certbot_args[@]}"
}

cleanup_remote_files() {
  rm -f "${REMOTE_ARCHIVE}" /tmp/production.env "${REMOTE_SCRIPT_PATH}"
}

require_root
install_packages
deploy_release
write_systemd_service
write_nginx_site

if [[ "${ENABLE_SSL}" == "true" && -n "${CERTBOT_EMAIL}" ]]; then
  issue_certificate
fi

cleanup_remote_files
systemctl status "${APP_NAME}" --no-pager || true
REMOTE_SCRIPT

tar \
  --exclude=".git" \
  --exclude=".gitignore" \
  --exclude=".venv" \
  --exclude="node_modules" \
  --exclude="scripts/*.log" \
  -C "${ROOT_DIR}" \
  -czf "${ARCHIVE_PATH}" \
  .

echo "Uploading release archive to ${SSH_TARGET}:${REMOTE_ARCHIVE}"
"${SCP_CMD[@]}" "${ARCHIVE_PATH}" "${ENV_FILE}" "${REMOTE_SCRIPT_FILE}" "${SSH_TARGET}:/tmp/"

echo "Starting remote deployment in ${DEPLOY_MODE} mode"

if [[ "${DEPLOY_MODE}" == "attached" ]]; then
  "${SSH_CMD[@]}" "${SSH_TARGET}" \
    APP_NAME="${APP_NAME}" \
    APP_DIR="${APP_DIR}" \
    APP_PORT="${APP_PORT}" \
    NODE_MAJOR="${NODE_MAJOR}" \
    DOMAIN="${DOMAIN}" \
    DOMAIN_ALIASES="${DOMAIN_ALIASES}" \
    REMOTE_ARCHIVE="${REMOTE_ARCHIVE}" \
    REMOTE_SCRIPT_PATH="${REMOTE_SCRIPT_PATH}" \
    RELEASE_ID="${RELEASE_ID}" \
    ENABLE_SSL="${ENABLE_SSL}" \
    CERTBOT_EMAIL="${CERTBOT_EMAIL}" \
    /bin/bash "${REMOTE_SCRIPT_PATH}"

  echo "Deployment complete."
  echo "App URL: http://${DOMAIN}"
  if [[ "${ENABLE_SSL}" == "true" && -n "${CERTBOT_EMAIL}" ]]; then
    echo "SSL requested via Let's Encrypt for ${DOMAIN}"
  fi
  exit 0
fi

"${SSH_CMD[@]}" "${SSH_TARGET}" \
  APP_NAME="${APP_NAME}" \
  APP_DIR="${APP_DIR}" \
  APP_PORT="${APP_PORT}" \
  NODE_MAJOR="${NODE_MAJOR}" \
  DOMAIN="${DOMAIN}" \
  DOMAIN_ALIASES="${DOMAIN_ALIASES}" \
  REMOTE_ARCHIVE="${REMOTE_ARCHIVE}" \
  REMOTE_SCRIPT_PATH="${REMOTE_SCRIPT_PATH}" \
  RELEASE_ID="${RELEASE_ID}" \
  ENABLE_SSL="${ENABLE_SSL}" \
  CERTBOT_EMAIL="${CERTBOT_EMAIL}" \
  REMOTE_LOG_PATH="${REMOTE_LOG_PATH}" \
  /bin/bash -lc 'nohup /bin/bash "${REMOTE_SCRIPT_PATH}" >"${REMOTE_LOG_PATH}" 2>&1 </dev/null & echo $!'

echo "Remote deployment started in background."
echo "Remote log: ${REMOTE_LOG_PATH}"
echo "Check progress with:"
echo "ssh ${SSH_OPTIONS[*]} -p ${VPS_PORT} ${SSH_TARGET} 'tail -n 80 ${REMOTE_LOG_PATH}'"
echo "When it finishes, verify with:"
echo "ssh ${SSH_OPTIONS[*]} -p ${VPS_PORT} ${SSH_TARGET} 'systemctl status ${APP_NAME} --no-pager && curl http://127.0.0.1:${APP_PORT}/api/v1/health'"
if [[ "${ENABLE_SSL}" == "true" && -n "${CERTBOT_EMAIL}" ]]; then
  echo "After HTTP is stable, switch Cloudflare SSL/TLS to Full (strict)."
fi
