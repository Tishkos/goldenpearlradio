# VPS Docker Deploy Guide

This guide deploys the full app on one VPS with Docker:

- `frontend` (Nginx serving built Vite app)
- `backend` (Express + stream server)
- `postgres`

## 1) Prepare VPS

Install Docker + Compose plugin on Ubuntu:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Open firewall:

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
```

## 2) Upload project

```bash
git clone <your-repo-url> radio
cd radio
```

## 3) Create VPS environment file

Create `.env.vps` in project root:

```bash
POSTGRES_USER=radio_user
POSTGRES_PASSWORD=change_this_super_strong
POSTGRES_DB=radio_db

JWT_SECRET=change_this_super_strong_jwt_secret

# Public URL used by backend in links/stream metadata
PUBLIC_BASE_URL=http://YOUR_DOMAIN_OR_SERVER_IP

# Frontend build-time API/stream URLs
VITE_API_URL=http://YOUR_DOMAIN_OR_SERVER_IP/api
VITE_STREAM_SERVER_URL=http://YOUR_DOMAIN_OR_SERVER_IP

# CORS (comma-separated if needed)
CORS_ORIGIN=http://YOUR_DOMAIN_OR_SERVER_IP

# Optional
STREAM_TIMEZONE=Europe/Budapest
```

If you use HTTPS later, update all URLs above to `https://...` and redeploy.

## 4) Build and start

```bash
docker compose -f docker-compose.vps.yml --env-file .env.vps up -d --build
```

Check status:

```bash
docker compose -f docker-compose.vps.yml ps
docker compose -f docker-compose.vps.yml logs -f backend
```

## 4.1) Create admin user (first deploy)

Run once after containers are up:

```bash
docker compose -f docker-compose.vps.yml --env-file .env.vps exec backend sh -lc "ADMIN_EMAIL=admin@goldenpearlradio.com ADMIN_USERNAME=admin ADMIN_PASSWORD='CHANGE_ME_STRONG' ADMIN_FULL_NAME='Golden Pearl Admin' npm run db:create-admin"
```

Then log in at `/login` with that email/password.

## 5) Update deployment

```bash
git pull
docker compose -f docker-compose.vps.yml --env-file .env.vps up -d --build
```

## 6) Backup important data

Persisted by Docker volumes:

- `postgres_data`
- `uploads_data`

Example DB backup:

```bash
docker exec -t radio_postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

## 7) TLS (recommended)

Use Cloudflare Tunnel, Caddy, Traefik, or Nginx Proxy Manager in front of this stack.
After enabling TLS, set in `.env.vps`:

- `PUBLIC_BASE_URL=https://your-domain`
- `VITE_API_URL=https://your-domain/api`
- `VITE_STREAM_SERVER_URL=https://your-domain`

Then rebuild:

```bash
docker compose -f docker-compose.vps.yml --env-file .env.vps up -d --build
```
