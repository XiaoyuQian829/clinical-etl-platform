output "api_public_ip" {
  description = "EC2 Elastic IP — FastAPI base URL"
  value       = "http://${aws_eip.api.public_ip}"
}

output "api_docs_url" {
  description = "Swagger UI"
  value       = "http://${aws_eip.api.public_ip}/docs"
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (private)"
  value       = aws_db_instance.postgres.address
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for raw MIMIC-IV data"
  value       = aws_s3_bucket.raw_data.bucket
}

output "amplify_app_id" {
  description = "Amplify app ID — open in AWS console to trigger first build"
  value       = aws_amplify_app.frontend.id
}

output "amplify_default_domain" {
  description = "Frontend URL (available after first Amplify build)"
  value       = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.frontend.default_domain}"
}

output "next_steps" {
  description = "What to do after terraform apply"
  value = <<-EOT
    1. Upload CSV data to S3:
       export S3_BUCKET=$(terraform output -raw s3_bucket_name)
       python databricks/upload_to_s3.py

    2. Trigger Amplify build:
       aws amplify start-job \
         --app-id $(terraform output -raw amplify_app_id) \
         --branch-name master \
         --job-type RELEASE

    3. Check API health:
       curl $(terraform output -raw api_public_ip)/health

    4. Open frontend:
       $(terraform output -raw amplify_default_domain)
  EOT
}
