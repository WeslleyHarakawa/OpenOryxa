#!/usr/bin/env bash
set -euo pipefail

# OpenOryxa Installer
# https://oryxa.digital
# Usage: curl -fsSL https://get.oryxa.digital | bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

MANAGER_IMAGE="ghcr.io/weslleyharakawa/openoryxa-manager:latest"
INSTALL_DIR="/opt/openoryxa"
TRAEFIK_NET="traefik-net"
UPDATE_MODE=false
DNS_CONFIGURED=false

[[ "${1:-}" == "--update" ]] && UPDATE_MODE=true

print_banner() {
  echo ""
  echo -e "${BOLD}  ██████  ██████  ███████ ███    ██  ██████  ██████  ██    ██ ██   ██  █████  ${RESET}"
  echo -e "${CYAN}  ██    ██ ██   ██ ██      ████   ██ ██    ██ ██   ██  ██  ██  ██   ██ ██   ██ ${RESET}"
  echo -e "${CYAN}  ██    ██ ██████  █████   ██ ██  ██ ██    ██ ██████    ████   ███████ ███████ ${RESET}"
  echo -e "${CYAN}  ██    ██ ██      ██      ██  ██ ██ ██    ██ ██   ██    ██    ██   ██ ██   ██ ${RESET}"
  echo -e "${BOLD}  ██████  ██      ███████ ██   ████  ██████  ██   ██    ██    ██   ██ ██   ██ ${RESET}"
  echo ""
  echo -e "  ${CYAN}Self-hosted OpenClaw AI Agent SaaS Platform${RESET}  ·  ${YELLOW}oryxa.digital${RESET}"
  echo -e "  ${BOLD}by Weslley Harakawa${RESET}  ·  ${DIM}github.com/WeslleyHarakawa/OpenOryxa${RESET}"
  echo ""
}

step() { echo -e "\n${CYAN}[*]${RESET} ${BOLD}$1${RESET}"; }
ok()   { echo -e "    ${GREEN}✓${RESET} $1"; }
warn() { echo -e "    ${YELLOW}!${RESET} $1"; }
err()  { echo -e "    ${RED}✗${RESET} $1"; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || err "Please run as root: sudo bash <(curl -fsSL https://get.oryxa.digital)"
}

check_os() {
  step "Checking system"
  . /etc/os-release 2>/dev/null || err "Cannot detect OS"
  [[ "$ID" == "ubuntu" || "$ID" == "debian" ]] || warn "Untested OS: $ID. Ubuntu 22.04+ recommended."
  ok "OS: $PRETTY_NAME"

  ARCH=$(uname -m)
  [[ "$ARCH" == "x86_64" || "$ARCH" == "aarch64" ]] || err "Unsupported arch: $ARCH"
  ok "Arch: $ARCH"

  MEM_MB=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
  [[ $MEM_MB -ge 800 ]] || warn "Low memory: ${MEM_MB}MB. At least 1GB recommended."
  ok "Memory: ${MEM_MB}MB"
}

install_docker() {
  step "Installing Docker"
  if command -v docker &>/dev/null; then
    ok "Docker already installed: $(docker --version)"
    return
  fi

  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker installed: $(docker --version)"
}

setup_network() {
  step "Setting up Docker network"
  if docker network inspect "$TRAEFIK_NET" &>/dev/null; then
    ok "Network '$TRAEFIK_NET' already exists"
  else
    docker network create "$TRAEFIK_NET"
    ok "Created network '$TRAEFIK_NET'"
  fi
}

collect_config() {
  $UPDATE_MODE && return

  # Redirect stdin to /dev/tty so read works when script is piped (curl | bash)
  exec < /dev/tty

  step "Configuration"
  echo ""
  read -rp "  Domain (e.g. yourdomain.com): " DOMAIN
  [[ -n "$DOMAIN" ]] || err "Domain is required"

  read -rp "  Admin email (for SSL certs): " ACME_EMAIL
  [[ -n "$ACME_EMAIL" ]] || err "Email is required"

  echo "  Cloudflare API token ${DIM}(optional — needed for wildcard SSL *.domain)${RESET}"
  echo "  ${DIM}→ cloudflare.com/profile/api-tokens → Use template: \"Edit zone DNS\"${RESET}"
  read -rp "  CF API token (or leave blank to skip): " CF_TOKEN

  read -rp "  Dashboard subdomain [default: dashboard]: " DASH_SUB
  DASH_SUB="${DASH_SUB:-dashboard}"

  echo ""
  read -rsp "  Admin password (leave blank to generate): " ADMIN_PASS
  echo ""
  if [[ -z "$ADMIN_PASS" ]]; then
    ADMIN_PASS=$(openssl rand -base64 18 | tr -d '=/+')
    warn "Generated password: ${BOLD}$ADMIN_PASS${RESET} (save this!)"
  fi

  echo ""
  echo "  AI Provider (used as default for new agents):"
  echo "    1) OpenAI          (GPT-4o, GPT-4.1, ...)"
  echo "    2) Anthropic       (Claude 3.5, Claude 4, ...)"
  echo "    3) Google Gemini   (Gemini 2.0, ...)"
  echo "    4) Groq            (Llama 3, Mixtral, fast inference)"
  echo "    5) Ollama          (local models, no key needed)"
  echo "    6) Skip            (configure later in dashboard)"
  echo ""
  read -rp "  Choose provider [1-6, default 6]: " AI_CHOICE

  AI_PROVIDER=""
  AI_API_KEY=""
  case "${AI_CHOICE:-6}" in
    1) AI_PROVIDER="openai"
       read -rsp "  OpenAI API key (sk-...): " AI_API_KEY; echo "" ;;
    2) AI_PROVIDER="anthropic"
       read -rsp "  Anthropic API key (sk-ant-...): " AI_API_KEY; echo "" ;;
    3) AI_PROVIDER="gemini"
       read -rsp "  Google Gemini API key: " AI_API_KEY; echo "" ;;
    4) AI_PROVIDER="groq"
       read -rsp "  Groq API key (gsk_...): " AI_API_KEY; echo "" ;;
    5) AI_PROVIDER="ollama" ;;
    *) warn "AI provider skipped — configure in the dashboard after install." ;;
  esac
}

write_config() {
  $UPDATE_MODE && return

  step "Writing configuration"
  mkdir -p "$INSTALL_DIR"

  local resolver="letsencrypt"
  [[ -n "${CF_TOKEN:-}" ]] && resolver="cloudflare"

  cat > "$INSTALL_DIR/.env" <<EOF
DOMAIN=${DOMAIN}
DASHBOARD_SUBDOMAIN=${DASH_SUB}
ACME_EMAIL=${ACME_EMAIL}
CLOUDFLARE_API_TOKEN=${CF_TOKEN:-}
ADMIN_PASSWORD=${ADMIN_PASS}
DEFAULT_AI_PROVIDER=${AI_PROVIDER:-}
DEFAULT_AI_API_KEY=${AI_API_KEY:-}
CERT_RESOLVER=${resolver}
EOF

  chmod 600 "$INSTALL_DIR/.env"
  ok "Config written to $INSTALL_DIR/.env"
}

setup_dns() {
  [[ -z "${CF_TOKEN:-}" ]] && return

  step "Configuring Cloudflare DNS"

  # Detect server public IP
  SERVER_IP=$(curl -s --max-time 10 https://ipv4.icanhazip.com 2>/dev/null || \
              curl -s --max-time 10 https://api.ipify.org 2>/dev/null || true)
  SERVER_IP="${SERVER_IP//[$'\t\r\n ']}"

  if [[ -z "$SERVER_IP" ]]; then
    warn "Could not detect server IP — add *.${DOMAIN} → your server IP in Cloudflare manually."
    return
  fi
  ok "Server IP: $SERVER_IP"

  # Find zone ID for the domain
  CF_ZONE_RESP=$(curl -s --max-time 10 \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}&status=active" 2>/dev/null || true)

  ZONE_ID=$(echo "$CF_ZONE_RESP" | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(d['result'][0]['id'])" 2>/dev/null || true)

  if [[ -z "$ZONE_ID" ]]; then
    warn "Zone '${DOMAIN}' not found in Cloudflare (check token permissions) — add *.${DOMAIN} → ${SERVER_IP} manually."
    return
  fi
  ok "Zone: ${DOMAIN}"

  # Check if wildcard A record already exists
  CF_REC_RESP=$(curl -s --max-time 10 \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=A&name=*.${DOMAIN}" 2>/dev/null || true)

  EXISTING_ID=$(echo "$CF_REC_RESP" | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('result') else '')" 2>/dev/null || true)

  RECORD_PAYLOAD="{\"type\":\"A\",\"name\":\"*.${DOMAIN}\",\"content\":\"${SERVER_IP}\",\"proxied\":false,\"ttl\":1}"

  if [[ -n "$EXISTING_ID" ]]; then
    curl -s --max-time 10 -X PUT \
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$RECORD_PAYLOAD" \
      "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${EXISTING_ID}" > /dev/null 2>&1 || true
    ok "Updated wildcard DNS: *.${DOMAIN} → ${SERVER_IP} (DNS-only)"
  else
    curl -s --max-time 10 -X POST \
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$RECORD_PAYLOAD" \
      "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" > /dev/null 2>&1 || true
    ok "Created wildcard DNS: *.${DOMAIN} → ${SERVER_IP} (DNS-only)"
  fi

  DNS_CONFIGURED=true
}

deploy_traefik() {
  step "Deploying Traefik (reverse proxy + SSL)"

  source "$INSTALL_DIR/.env" 2>/dev/null || true

  mkdir -p "$INSTALL_DIR/traefik/certs"
  touch "$INSTALL_DIR/traefik/acme.json"
  chmod 600 "$INSTALL_DIR/traefik/acme.json"

  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    CF_ENV="CF_DNS_API_TOKEN=${CLOUDFLARE_API_TOKEN}"
    CERT_RESOLVER_CFG='
      [certificatesResolvers.cloudflare.acme]
        email = "'${ACME_EMAIL}'"
        storage = "/acme.json"
        [certificatesResolvers.cloudflare.acme.dnsChallenge]
          provider = "cloudflare"
          resolvers = ["1.1.1.1:53","8.8.8.8:53"]'
    RESOLVER="cloudflare"
  else
    CF_ENV=""
    CERT_RESOLVER_CFG='
      [certificatesResolvers.letsencrypt.acme]
        email = "'${ACME_EMAIL}'"
        storage = "/acme.json"
        [certificatesResolvers.letsencrypt.acme.tlsChallenge]'
    RESOLVER="letsencrypt"
  fi

  cat > "$INSTALL_DIR/traefik/traefik.toml" <<EOF
[global]
  checkNewVersion = false
  sendAnonymousUsage = false

[log]
  level = "INFO"

[entryPoints.web]
  address = ":80"
  [entryPoints.web.http.redirections.entryPoint]
    to = "websecure"
    scheme = "https"

[entryPoints.websecure]
  address = ":443"

[providers.docker]
  network = "${TRAEFIK_NET}"
  exposedByDefault = false

[api]
  dashboard = false
${CERT_RESOLVER_CFG}
EOF

  if docker ps -a --format '{{.Names}}' | grep -q '^traefik$'; then
    docker rm -f traefik
  fi

  docker run -d \
    --name traefik \
    --restart unless-stopped \
    --network "$TRAEFIK_NET" \
    -p 80:80 -p 443:443 \
    ${CF_ENV:+-e "$CF_ENV"} \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    -v "$INSTALL_DIR/traefik/traefik.toml:/traefik.toml:ro" \
    -v "$INSTALL_DIR/traefik/acme.json:/acme.json" \
    traefik:v3.1

  ok "Traefik started"
}

deploy_manager() {
  step "Deploying OpenOryxa manager"

  source "$INSTALL_DIR/.env"

  docker pull "$MANAGER_IMAGE" 2>/dev/null || warn "Could not pull latest image, using local if available"

  if docker ps -a --format '{{.Names}}' | grep -q '^openoryxa-manager$'; then
    docker rm -f openoryxa-manager
    ok "Removed old manager container"
  fi

  mkdir -p "$INSTALL_DIR/data"

  docker run -d \
    --name openoryxa-manager \
    --restart unless-stopped \
    --network "$TRAEFIK_NET" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$INSTALL_DIR/data:/data" \
    -e "DOMAIN=${DOMAIN}" \
    -e "ADMIN_EMAIL=admin@${DOMAIN}" \
    -e "ADMIN_PASSWORD=${ADMIN_PASSWORD}" \
    -e "TRAEFIK_NETWORK=${TRAEFIK_NET}" \
    -e "DEFAULT_AI_PROVIDER=${DEFAULT_AI_PROVIDER:-}" \
    -e "DEFAULT_AI_API_KEY=${DEFAULT_AI_API_KEY:-}" \
    -l "traefik.enable=true" \
    -l "traefik.http.routers.manager.rule=Host(\`${DASHBOARD_SUBDOMAIN}.${DOMAIN}\`)" \
    -l "traefik.http.routers.manager.entrypoints=websecure" \
    -l "traefik.http.routers.manager.tls.certresolver=${CERT_RESOLVER}" \
    -l "traefik.http.services.manager.loadbalancer.server.port=3000" \
    "$MANAGER_IMAGE"

  sleep 3
  if ! docker ps --format '{{.Names}}' | grep -q '^openoryxa-manager$'; then
    echo ""
    warn "Manager container exited — last logs:"
    docker logs openoryxa-manager 2>&1 | tail -30
    err "Manager failed to start. Check logs above."
  fi

  ok "Manager started"
}

print_success() {
  echo ""
  echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${GREEN}${BOLD}  ✓ OpenOryxa is ready!${RESET}"
  echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  source "$INSTALL_DIR/.env"
  echo -e "  Dashboard:  ${CYAN}https://${DASHBOARD_SUBDOMAIN}.${DOMAIN}${RESET}"
  echo -e "  Login:      ${YELLOW}admin@${DOMAIN}${RESET}"
  echo -e "  Password:   ${YELLOW}${ADMIN_PASSWORD}${RESET}"
  echo ""
  echo -e "  ${BOLD}Next steps:${RESET}"
  if [[ "$DNS_CONFIGURED" == "true" ]]; then
    echo -e "  1. Visit the dashboard and create your first agent"
    echo -e "  2. Connect WhatsApp or Telegram"
    echo ""
    echo -e "  ${DIM}✓ Wildcard DNS *.${DOMAIN} configured automatically via Cloudflare.${RESET}"
    echo -e "  ${DIM}  SSL certificate will be issued on first request (up to 2 min).${RESET}"
  else
    echo -e "  1. Point ${BOLD}*.${DOMAIN}${RESET} → this server's IP in Cloudflare DNS"
    echo -e "  2. Visit the dashboard and create your first agent"
    echo -e "  3. Connect WhatsApp or Telegram"
  fi
  echo ""
  echo -e "  ${CYAN}Docs:${RESET} https://docs.oryxa.digital"
  echo -e "  ${CYAN}GitHub:${RESET} https://github.com/WeslleyHarakawa/OpenOryxa"
  echo ""
}

main() {
  print_banner
  require_root
  check_os
  install_docker
  setup_network

  if $UPDATE_MODE; then
    step "Update mode"
    deploy_manager
    ok "Update complete"
  else
    collect_config
    write_config
    setup_dns
    deploy_traefik
    deploy_manager
    print_success
  fi
}

main "$@"
