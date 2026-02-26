#!/bin/bash
# ============================================================
# SKYNT NFT Launchpad — Digital Ocean Ubuntu Droplet Bootstrap
# ============================================================
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Holedozer1229/NFT-Launchpad/main/scripts/bootstrap-droplet.sh | sudo bash
# Or after cloning:
#   sudo bash scripts/bootstrap-droplet.sh
#
# Tested on Ubuntu 22.04 LTS and 24.04 LTS (x86_64 / arm64)
# Run as root or with sudo.
# ============================================================

set -euo pipefail

# ---- Configurable variables --------------------------------
APP_USER="${APP_USER:-skynt}"
APP_DIR="${APP_DIR:-/opt/skynt}"
REPO_URL="${REPO_URL:-https://github.com/Holedozer1229/NFT-Launchpad.git}"
NODE_MAJOR="${NODE_MAJOR:-20}"
PG_VERSION="${PG_VERSION:-15}"
DB_NAME="${DB_NAME:-skynt}"
DB_USER="${DB_USER:-skynt}"
PORT="${PORT:-5000}"
DOMAIN="${DOMAIN:-}"          # Set to your domain to enable Nginx + Certbot
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"  # Required when DOMAIN is set; e.g. admin@example.com
# ------------------------------------------------------------

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

[[ $EUID -ne 0 ]] && error "This script must be run as root. Use: sudo bash $0"

# ============================================================
# 1. System update
# ============================================================
info "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg2 lsb-release \
    git build-essential ufw

# ============================================================
# 2. Node.js
# ============================================================
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')" != "$NODE_MAJOR" ]]; then
    info "Installing Node.js $NODE_MAJOR..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
else
    info "Node.js $(node --version) already installed."
fi

# ============================================================
# 3. PostgreSQL
# ============================================================
if ! command -v psql &>/dev/null; then
    info "Installing PostgreSQL $PG_VERSION..."
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    apt-get update -y
    apt-get install -y "postgresql-$PG_VERSION"
    systemctl enable --now postgresql
else
    info "PostgreSQL $(psql --version) already installed."
fi

# ============================================================
# 4. Create DB user and database
# ============================================================
info "Setting up PostgreSQL database '$DB_NAME' and user '$DB_USER'..."
DB_PASS="$(openssl rand -hex 24)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" \
    | grep -q 1 || sudo -u postgres psql -c \
    "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" \
    | grep -q 1 || sudo -u postgres psql -c \
    "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# ============================================================
# 5. Application user
# ============================================================
if ! id "$APP_USER" &>/dev/null; then
    info "Creating system user '$APP_USER'..."
    useradd -r -m -d "$APP_DIR" -s /bin/bash "$APP_USER"
else
    info "User '$APP_USER' already exists."
fi

# ============================================================
# 6. Clone / update repository
# ============================================================
if [[ -d "$APP_DIR/.git" ]]; then
    info "Updating existing repository in $APP_DIR..."
    sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
else
    info "Cloning repository into $APP_DIR..."
    rm -rf "$APP_DIR"
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
fi

# ============================================================
# 7. Generate SESSION_SECRET and write .env
# ============================================================
SESSION_SECRET="$(openssl rand -hex 32)"
ENV_FILE="$APP_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
    warn ".env already exists — skipping generation. Update DATABASE_URL and SESSION_SECRET manually if needed."
else
    info "Writing $ENV_FILE..."
    cat > "$ENV_FILE" <<EOF
# Generated by bootstrap-droplet.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
NODE_ENV=production
PORT=$PORT
DATABASE_URL=$DATABASE_URL
SESSION_SECRET=$SESSION_SECRET

# Optional — uncomment and fill in if you need these features:
# AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
# OPENSEA_API_KEY=
# VITE_INFURA_API_KEY=
EOF
    chown "$APP_USER:$APP_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
fi

# ============================================================
# 8. Install npm dependencies and build
# ============================================================
info "Installing npm dependencies..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci --omit=dev || npm install --omit=dev"

info "Building production bundle..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm run build"

# ============================================================
# 9. Push database schema
# ============================================================
info "Pushing Drizzle schema to database..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm run db:push"

# ============================================================
# 10. systemd service
# ============================================================
SERVICE_FILE="/etc/systemd/system/skynt.service"
info "Installing systemd service..."
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=SKYNT NFT Launchpad
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $APP_DIR/dist/index.cjs
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=skynt

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable skynt
systemctl restart skynt
info "skynt.service started. Check status: systemctl status skynt"

# ============================================================
# 11. Firewall
# ============================================================
info "Configuring UFW firewall..."
ufw --force enable
ufw allow OpenSSH
ufw allow "$PORT/tcp"

# ============================================================
# 12. Optional Nginx reverse proxy + Certbot TLS
# ============================================================
if [[ -n "$DOMAIN" ]]; then
    info "Installing Nginx and Certbot for domain $DOMAIN..."
    if [[ -z "$CERTBOT_EMAIL" ]]; then
        error "CERTBOT_EMAIL must be set when DOMAIN is provided. Example: CERTBOT_EMAIL=admin@example.com DOMAIN=$DOMAIN sudo bash $0"
    fi
    apt-get install -y nginx certbot python3-certbot-nginx

    NGINX_CONF="/etc/nginx/sites-available/skynt"
    cat > "$NGINX_CONF" <<NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/skynt
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx

    info "Obtaining TLS certificate for $DOMAIN..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
        --email "$CERTBOT_EMAIL" --redirect || \
        warn "Certbot failed — run manually: certbot --nginx -d $DOMAIN --email $CERTBOT_EMAIL"

    ufw allow 'Nginx Full'
    ufw delete allow "$PORT/tcp" 2>/dev/null || true
fi

# ============================================================
# Done
# ============================================================
echo ""
echo -e "${GREEN}========================================================"
echo " SKYNT Bootstrap Complete!"
echo -e "========================================================${NC}"
echo ""
echo "  App directory : $APP_DIR"
echo "  Service       : systemctl {start|stop|restart|status} skynt"
echo "  Logs          : journalctl -u skynt -f"
if [[ -n "$DOMAIN" ]]; then
    echo "  URL           : https://$DOMAIN"
else
    DROPLET_IP="$(curl -sf --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null)"
    if [[ -z "$DROPLET_IP" ]]; then
        DROPLET_IP="$(hostname -I | awk '{print $1}')"
        warn "Could not detect public IP via metadata; using $DROPLET_IP (may be a private address)."
    fi
    echo "  URL           : http://$DROPLET_IP:$PORT"
fi
echo ""
if [[ ! -f "$ENV_FILE" ]]; then
    warn "Remember to edit $ENV_FILE with your real secrets before starting the service."
else
    warn "Your generated DB password is stored in $ENV_FILE — back it up securely."
fi
echo ""
