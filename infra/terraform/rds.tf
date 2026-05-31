# ── RDS subnet group ──────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  tags       = { Name = "${local.name_prefix}-db-subnet-group" }
}

# ── RDS PostgreSQL instance ───────────────────────────────────────────────────

resource "aws_db_instance" "postgres" {
  identifier        = "${local.name_prefix}-postgres-${local.suffix}"
  engine            = "postgres"
  engine_version    = "15.10"
  instance_class    = "db.t3.micro"   # Free Tier eligible
  allocated_storage = 20
  storage_type      = "gp2"

  db_name  = "clinical_etl"
  username = "clinicaladmin"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible     = false   # only accessible from EC2 inside VPC
  skip_final_snapshot     = true
  deletion_protection     = false
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  tags = { Name = "${local.name_prefix}-postgres" }
}
