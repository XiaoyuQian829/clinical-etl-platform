#!/bin/bash
exec > /var/log/userdata.log 2>&1
set -xe

echo "=== Starting ClinicalETL setup $(date) ==="

# ── System packages (Amazon Linux 2023) ───────────────────────────────────────
dnf update -y
dnf install -y python3.11 python3-pip git postgresql15 postgresql15-devel gcc nginx

# Make python3.11 the default pip target
python3.11 -m ensurepip --upgrade
python3.11 -m pip install --upgrade pip

# ── Node.js 20 ────────────────────────────────────────────────────────────────
dnf install -y nodejs npm

# ── Clone repo ────────────────────────────────────────────────────────────────
git clone https://github.com/XiaoyuQian829/clinical-etl-platform.git /opt/clinical-etl
cd /opt/clinical-etl

# ── Python deps ───────────────────────────────────────────────────────────────
python3.11 -m pip install -r requirements.txt
python3.11 -m pip install dbt-postgres==1.8.0

# ── Environment file ─────────────────────────────────────────────────────────
cat > /opt/clinical-etl/.env <<ENVEOF
POSTGRES_HOST=${db_host}
POSTGRES_PORT=5432
POSTGRES_DB=${db_name}
POSTGRES_USER=${db_user}
POSTGRES_PASSWORD=${db_password}
JWT_SECRET_KEY=${jwt_secret}
AWS_REGION=${aws_region}
S3_BUCKET=${s3_bucket}
ENVEOF

# ── Init database schema ──────────────────────────────────────────────────────
export PGPASSWORD="${db_password}"
for i in $(seq 1 30); do
  if psql -h "${db_host}" -U "${db_user}" -d "${db_name}" -c "SELECT 1" > /dev/null 2>&1; then
    echo "RDS is ready"
    break
  fi
  echo "Waiting for RDS... attempt $i"
  sleep 10
done
psql -h "${db_host}" -U "${db_user}" -d "${db_name}" -f /opt/clinical-etl/infra/aws/rds_init.sql
echo "=== Database schema created ==="

# ── Build Next.js frontend ────────────────────────────────────────────────────
cd /opt/clinical-etl/frontend
npm ci
NEXT_PUBLIC_API_URL="http://${ec2_public_ip}:8000" npm run build
echo "=== Frontend built ==="

# ── Systemd: FastAPI ──────────────────────────────────────────────────────────
cat > /etc/systemd/system/clinical-etl-api.service <<SVCEOF
[Unit]
Description=ClinicalETL FastAPI
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/opt/clinical-etl
EnvironmentFile=/opt/clinical-etl/.env
ExecStart=/usr/local/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

# ── Systemd: Next.js ──────────────────────────────────────────────────────────
cat > /etc/systemd/system/clinical-etl-frontend.service <<SVCEOF
[Unit]
Description=ClinicalETL Next.js
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/opt/clinical-etl/frontend
Environment=PORT=3000
Environment=NEXT_PUBLIC_API_URL=http://${ec2_public_ip}:8000
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable clinical-etl-api clinical-etl-frontend
systemctl start clinical-etl-api clinical-etl-frontend

# ── Nginx ────────────────────────────────────────────────────────────────────
cat > /etc/nginx/conf.d/clinical-etl.conf <<NGXEOF
server {
    listen 80;
    server_name _;
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGXEOF

systemctl enable nginx
systemctl start nginx

echo "=== Setup complete $(date) ==="
echo "API: http://${ec2_public_ip}:8000"
echo "Frontend: http://${ec2_public_ip}:3000"
