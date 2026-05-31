#!/bin/bash
# EC2 setup script for ClinicalETL FastAPI backend
# Run once on a fresh Amazon Linux 2023 / Ubuntu 22.04 t3.micro instance

set -e

REPO_URL="https://github.com/YOUR_USERNAME/clinical-etl-platform.git"
APP_DIR="/opt/clinical-etl-platform"
SERVICE_USER="ec2-user"   # change to ubuntu on Ubuntu AMIs

# ── System packages ─────────────────────────────────────────────────────────
sudo dnf update -y                                  # Amazon Linux 2023
sudo dnf install -y python3.11 python3.11-pip git nginx

# ── Clone repo ───────────────────────────────────────────────────────────────
sudo mkdir -p "$APP_DIR"
sudo chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

# ── Python deps ──────────────────────────────────────────────────────────────
python3.11 -m pip install --upgrade pip
python3.11 -m pip install -r requirements.txt

# ── .env file ────────────────────────────────────────────────────────────────
# Copy .env.example and fill in values before running
cp .env.example .env
echo ">>> Edit $APP_DIR/.env with your secrets before starting the service <<<"

# ── systemd service ──────────────────────────────────────────────────────────
sudo tee /etc/systemd/system/clinical-etl.service > /dev/null <<EOF
[Unit]
Description=ClinicalETL FastAPI
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/python3.11 -m uvicorn api.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable clinical-etl
sudo systemctl start clinical-etl

# ── Nginx reverse proxy ───────────────────────────────────────────────────────
sudo tee /etc/nginx/conf.d/clinical-etl.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

sudo systemctl enable nginx
sudo systemctl restart nginx

echo "=== Setup complete ==="
echo "API:    http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/health"
echo "Docs:   http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/docs"
