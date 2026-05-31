# ── Latest Amazon Linux 2023 AMI ─────────────────────────────────────────────

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── EC2 instance (API server) ─────────────────────────────────────────────────

resource "aws_instance" "api" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = "t3.micro"   # Free Tier eligible
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = var.ec2_key_name != "" ? var.ec2_key_name : null

  user_data = base64encode(templatefile("${path.module}/templates/userdata.sh", {
    db_host     = aws_db_instance.postgres.address
    db_name     = aws_db_instance.postgres.db_name
    db_user     = aws_db_instance.postgres.username
    db_password = var.db_password
    jwt_secret  = var.jwt_secret
    s3_bucket   = aws_s3_bucket.raw_data.bucket
    aws_region  = var.aws_region
  }))

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = { Name = "${local.name_prefix}-api" }
}

# ── Elastic IP (stable public address) ───────────────────────────────────────

resource "aws_eip" "api" {
  instance = aws_instance.api.id
  domain   = "vpc"
  tags     = { Name = "${local.name_prefix}-api-eip" }
}
