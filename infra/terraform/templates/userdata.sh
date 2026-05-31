#!/bin/bash
set -e
exec > /var/log/userdata.log 2>&1

# ── System packages ───────────────────────────────────────────────────────────
dnf update -y
dnf install -y python3.11 python3.11-pip git postgresql15 nginx

# ── Clone repo ────────────────────────────────────────────────────────────────
git clone https://github.com/XiaoyuQian829/clinical-etl-platform.git /opt/clinical-etl
cd /opt/clinical-etl

# ── Python deps ───────────────────────────────────────────────────────────────
python3.11 -m pip install -r requirements.txt
python3.11 -m pip install dbt-postgres==1.8.0

# ── Environment file ─────────────────────────────────────────────────────────
cat > /opt/clinical-etl/.env <<EOF
POSTGRES_HOST=${db_host}
POSTGRES_PORT=5432
POSTGRES_DB=${db_name}
POSTGRES_USER=${db_user}
POSTGRES_PASSWORD=${db_password}
JWT_SECRET_KEY=${jwt_secret}
AWS_REGION=${aws_region}
S3_BUCKET=${s3_bucket}
EOF

# ── Init database schema ──────────────────────────────────────────────────────
export PGPASSWORD="${db_password}"
until psql -h "${db_host}" -U "${db_user}" -d "${db_name}" -c "SELECT 1" > /dev/null 2>&1; do
  echo "Waiting for RDS..."
  sleep 5
done
psql -h "${db_host}" -U "${db_user}" -d "${db_name}" -f /opt/clinical-etl/infra/aws/rds_init.sql

# ── Systemd service for FastAPI ───────────────────────────────────────────────
cat > /etc/systemd/system/clinical-etl.service <<EOF
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
EOF

systemctl daemon-reload
systemctl enable clinical-etl
systemctl start clinical-etl

# ── Nginx reverse proxy (port 80 → 8000) ─────────────────────────────────────
cat > /etc/nginx/conf.d/clinical-etl.conf <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

systemctl enable nginx
systemctl start nginx

echo "Setup complete."
