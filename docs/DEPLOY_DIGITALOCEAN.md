# Deploying SKYNT on a Digital Ocean Ubuntu Droplet

This guide walks you through creating a Digital Ocean Ubuntu droplet and running the one-line bootstrap script that installs every dependency, configures PostgreSQL, builds the application, and starts it as a systemd service.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Create the Droplet](#create-the-droplet)
3. [Initial SSH Access](#initial-ssh-access)
4. [Run the Bootstrap Script](#run-the-bootstrap-script)
5. [Bootstrap Variables Reference](#bootstrap-variables-reference)
6. [Post-Bootstrap Checklist](#post-bootstrap-checklist)
7. [Custom Domain & TLS (Optional)](#custom-domain--tls-optional)
8. [Useful Commands](#useful-commands)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A [Digital Ocean](https://cloud.digitalocean.com) account
- An SSH key pair added to your Digital Ocean account (recommended)
- (Optional) A domain name pointing to the droplet's IP address

---

## Create the Droplet

1. Log in to the [Digital Ocean control panel](https://cloud.digitalocean.com/droplets/new).
2. **Choose an image**: `Ubuntu 22.04 LTS (x86_64)` or `Ubuntu 24.04 LTS (x86_64)`.
3. **Choose a plan**: The app runs comfortably on a **Basic Shared CPU** droplet.  
   Recommended minimum: **2 vCPUs / 2 GB RAM / 50 GB SSD** (~$18/mo).
4. **Choose a datacenter region** closest to your users.
5. **Authentication**: Select your SSH key (preferred) or set a root password.
6. Click **Create Droplet** and wait for it to become active.
7. Note the public **IPv4 address** shown in the control panel.

---

## Initial SSH Access

```bash
# Replace <DROPLET_IP> with the IPv4 address from the control panel
ssh root@<DROPLET_IP>
```

If you used a password, you may be prompted to change it on first login.

---

## Run the Bootstrap Script

The bootstrap script (`scripts/bootstrap-droplet.sh`) performs all setup steps automatically:

| Step | What it does |
|------|-------------|
| 1 | Updates system packages |
| 2 | Installs Node.js 20 via the NodeSource repo |
| 3 | Installs PostgreSQL 15 via the official PGDG repo |
| 4 | Creates the `skynt` database user and database with a random password |
| 5 | Creates a dedicated `skynt` system user |
| 6 | Clones the repository to `/opt/skynt` |
| 7 | Generates `/opt/skynt/.env` with `DATABASE_URL` and `SESSION_SECRET` |
| 8 | Runs `npm install --omit=dev` and `npm run build` |
| 9 | Runs `npm run db:push` to apply the Drizzle schema |
| 10 | Installs and enables a **systemd service** (`skynt.service`) |
| 11 | Configures **UFW** to allow SSH and the app port (default `5000`) |
| 12 | *(Optional)* Installs Nginx + Certbot for a custom domain |

### One-liner (run as root on the droplet)

```bash
curl -fsSL https://raw.githubusercontent.com/Holedozer1229/NFT-Launchpad/main/scripts/bootstrap-droplet.sh | sudo bash
```

### With a custom domain and automatic TLS

```bash
DOMAIN=skynt.example.com CERTBOT_EMAIL=admin@example.com \
curl -fsSL https://raw.githubusercontent.com/Holedozer1229/NFT-Launchpad/main/scripts/bootstrap-droplet.sh | sudo -E bash
```

> **Note**: The domain DNS A-record must already point to the droplet's IP address before running with `DOMAIN=` so that Certbot can complete the HTTP-01 challenge.

### After cloning the repository manually

If you have already cloned the repo to the droplet:

```bash
cd /path/to/NFT-Launchpad
sudo bash scripts/bootstrap-droplet.sh
```

---

## Bootstrap Variables Reference

All variables are optional — defaults work out of the box. Export them before calling the script (or inline as shown above).

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_USER` | `skynt` | OS user that runs the app |
| `APP_DIR` | `/opt/skynt` | Installation directory |
| `REPO_URL` | *(GitHub repo)* | Git URL to clone |
| `NODE_MAJOR` | `20` | Node.js major version |
| `PG_VERSION` | `15` | PostgreSQL major version |
| `DB_NAME` | `skynt` | PostgreSQL database name |
| `DB_USER` | `skynt` | PostgreSQL database user |
| `PORT` | `5000` | Port the Express server listens on |
| `DOMAIN` | *(empty)* | Set to enable Nginx reverse proxy + Certbot TLS |
| `CERTBOT_EMAIL` | *(empty)* | Required when `DOMAIN` is set — used for TLS certificate registration |

Example with all variables:

```bash
APP_USER=skynt APP_DIR=/opt/skynt PORT=5000 \
  DOMAIN=skynt.example.com CERTBOT_EMAIL=admin@example.com \
  sudo -E bash scripts/bootstrap-droplet.sh
```

---

## Post-Bootstrap Checklist

After the script completes:

1. **Add API keys** (optional features):
   ```bash
   sudo nano /opt/skynt/.env
   ```
   Uncomment and fill in any of:
   - `AI_INTEGRATIONS_OPENAI_API_KEY` — Sphinx Oracle chat
   - `OPENSEA_API_KEY` — OpenSea listing integration
   - `VITE_INFURA_API_KEY` — MetaMask RPC provider

   Then restart the service:
   ```bash
   sudo systemctl restart skynt
   ```

2. **Verify the service is running**:
   ```bash
   sudo systemctl status skynt
   ```

3. **Open the app in your browser**:
   ```
   http://<DROPLET_IP>:5000
   ```
   (or `https://<DOMAIN>` if you set up a domain)

4. **Back up your `.env` file** — it contains the auto-generated database password and session secret.

---

## Custom Domain & TLS (Optional)

If you did not pass `DOMAIN=` during bootstrap you can set up Nginx manually:

```bash
# Install Nginx and Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Create Nginx site config
sudo tee /etc/nginx/sites-available/skynt > /dev/null <<'EOF'
server {
    listen 80;
    server_name skynt.example.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/skynt /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Obtain TLS certificate
sudo certbot --nginx -d skynt.example.com

# Allow HTTPS through firewall and remove the direct-port rule
sudo ufw allow 'Nginx Full'
sudo ufw delete allow 5000/tcp
```

---

## Useful Commands

```bash
# View live application logs
journalctl -u skynt -f

# Restart after editing .env
sudo systemctl restart skynt

# Stop / start the service
sudo systemctl stop skynt
sudo systemctl start skynt

# Check service status
sudo systemctl status skynt

# Update the application
cd /opt/skynt
sudo -u skynt git pull
sudo -u skynt npm install --omit=dev
sudo -u skynt npm run build
sudo -u skynt npm run db:push
sudo systemctl restart skynt

# Connect to the database as the skynt user
sudo -u skynt psql postgresql://skynt@localhost/skynt
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Service fails to start | Missing or wrong `DATABASE_URL` in `.env` | Check `/opt/skynt/.env`; ensure PostgreSQL is running (`systemctl status postgresql`) |
| Port 5000 unreachable | UFW blocking traffic | `sudo ufw allow 5000/tcp` |
| `npm run build` error | Incompatible Node.js version | Ensure Node.js 20 is installed: `node --version` |
| Certbot fails | DNS not propagated yet | Wait for DNS TTL to expire, then re-run `certbot --nginx -d <domain>` |
| Database schema errors | Schema not pushed | Run `sudo -u skynt bash -c 'cd /opt/skynt && npm run db:push'` |
