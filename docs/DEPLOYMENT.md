# ECOFlow — Production Deployment Runbook

This document details the configuration, security hardening, containerization, systemd process supervision, reverse proxy termination, and graceful shutdown procedures for deploying ECOFlow to a production Linux/UNIX environment.

---

## 1. System Requirements & Architecture

- **Host Operating System:** Linux (Ubuntu 22.04 LTS / Debian 12 / RHEL 9 recommended)
- **Node.js:** v20.x LTS or higher
- **PostgreSQL Database:** PostgreSQL 15 or 18 with SSL encryption enabled
- **Reverse Proxy:** NGINX or Caddy for TLS 1.3 termination, rate limiting, and HTTP/2
- **Memory Requirements:**
  - Backend API: 1 GB minimum, 2 GB recommended
  - PostgreSQL: 2 GB minimum, 4 GB recommended
  - Reverse proxy + static frontend: 512 MB

---

## 2. Production Environment Variables Reference

All production secrets must be generated using cryptographically strong pseudo-random number generators (CSPRNG, e.g. `openssl rand -hex 32`).

| Variable | Type | Required | Description | Example |
|---|---|---|---|---|
| `NODE_ENV` | String | **Yes** | Execution mode; must be set to `production` | `production` |
| `PORT` | Number | No | Port on which the Express server listens (default: `4000`) | `4000` |
| `DATABASE_URL` | String | **Yes** | PostgreSQL connection pooler or direct connection URI | `postgresql://ecoflow_user:strong_pw@db.internal:5432/ecoflow_prod?sslmode=require` |
| `DIRECT_URL` | String | No | Direct connection string for DDL migrations | `postgresql://ecoflow_admin:admin_pw@db.internal:5432/ecoflow_prod?sslmode=require` |
| `CORS_ORIGIN` | String | **Yes** | Allowed origin for CORS headers; no wildcards allowed in production | `https://ecoflow.internal.company.com` |
| `JWT_ACCESS_SECRET` | String | **Yes** | Minimum 32-character secret for signing access JWTs | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | String | **Yes** | Minimum 32-character secret for signing refresh tokens | `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRES_IN` | String | No | Lifetime of access tokens (default: `15m`) | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | String | No | Lifetime of refresh tokens (default: `7d`) | `7d` |

> [!CAUTION]
> If `NODE_ENV=production` and `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` contains `fallback` or is left unset, the backend process immediately terminates with a fatal error on boot.

---

## 3. Database Preparation & Migration Execution

Run migrations sequentially from migration 001 to migration 013 in the target database using `psql` or the migration runner:

```bash
export PGPASSWORD="your_secure_db_password"

# Apply all migrations atomically in order
for file in database/sql/{001..013}*.sql; do
  # Exclude rollback scripts
  if [[ "$file" != *"rollback"* ]]; then
    echo "Applying $file..."
    psql -h db.internal -p 5432 -U ecoflow_admin -d ecoflow_prod -f "$file"
  fi
done
```

---

## 4. Production Process Management (systemd)

Create a dedicated systemd service file at `/etc/systemd/system/ecoflow-backend.service`:

```ini
[Unit]
Description=ECOFlow Enterprise PLM Backend Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=ecoflow
Group=ecoflow
WorkingDirectory=/opt/ecoflow/backend
EnvironmentFile=/etc/ecoflow/backend.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5s

# Security Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ProtectKernelTunables=true
ProtectControlGroups=true
ReadWritePaths=/opt/ecoflow/backend/uploads

# Resource Limits
LimitNOFILE=65535
MemoryMax=2G

# Graceful Shutdown
TimeoutStopSec=30s
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
```

Reload systemd and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ecoflow-backend
sudo systemctl start ecoflow-backend
sudo systemctl status ecoflow-backend
```

---

## 5. Reverse Proxy Configuration (NGINX)

Deploy the built frontend assets to `/var/www/ecoflow-web/dist` and proxy API calls to the local Express backend on port `4000`.

`/etc/nginx/sites-available/ecoflow`:

```nginx
server {
    listen 80;
    server_name ecoflow.internal.company.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ecoflow.internal.company.com;

    # SSL Hardening
    ssl_certificate /etc/ssl/certs/ecoflow.crt;
    ssl_certificate_key /etc/ssl/private/ecoflow.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://ecoflow.internal.company.com;" always;

    # Frontend Single Page App
    root /var/www/ecoflow-web/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Healthcheck endpoints
    location /health {
        proxy_pass http://127.0.0.1:4000/health;
    }

    location /ready {
        proxy_pass http://127.0.0.1:4000/ready;
    }
}
```

---

## 6. Health & Readiness Verification

The application exposes standard Kubernetes/load-balancer probe endpoints:

1. **Liveness Probe (`GET /health`):**
   - Returns `200 OK` with uptime and timestamp if process is running.
2. **Readiness Probe (`GET /ready`):**
   - Performs a ping query `SELECT 1` against PostgreSQL.
   - Returns `200 OK` (`status: "ready", database: "connected"`) when ready to accept traffic.
   - Returns `503 Service Unavailable` if database connectivity is lost.

---

## 7. Graceful Shutdown & Zero-Downtime Releases

When updating the backend service:
1. `SIGTERM` is intercepted by Express.
2. New connections are rejected, while existing HTTP transactions are allowed up to 30 seconds to finish.
3. Database connections in the Prisma connection pool are gracefully closed via `prisma.$disconnect()`.
4. Process exits with code `0`.

