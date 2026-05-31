output "frontend_url" {
  description = "Next.js frontend"
  value       = "http://${aws_eip.api.public_ip}:3000"
}

output "api_url" {
  description = "FastAPI base URL"
  value       = "http://${aws_eip.api.public_ip}:8000"
}

output "api_docs_url" {
  description = "Swagger UI"
  value       = "http://${aws_eip.api.public_ip}:8000/docs"
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (private — only accessible from EC2)"
  value       = aws_db_instance.postgres.address
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for raw data"
  value       = aws_s3_bucket.raw_data.bucket
}

output "next_steps" {
  description = "What to do after terraform apply"
  value       = <<-EOT
    1. Wait ~5 minutes for EC2 userdata to finish (installs Python, Node, builds frontend)

    2. Check API health:
       curl http://${aws_eip.api.public_ip}:8000/health

    3. Open frontend:
       http://${aws_eip.api.public_ip}:3000

    4. Upload data to S3 and run pipeline:
       export S3_BUCKET=${aws_s3_bucket.raw_data.bucket}
       python databricks/upload_to_s3.py
  EOT
}
