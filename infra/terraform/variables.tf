variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-2"   # Sydney — closest to UQ Herston
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "db_password" {
  description = "PostgreSQL master password — set via TF_VAR_db_password env var, never hardcode"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret — set via TF_VAR_jwt_secret env var"
  type        = string
  sensitive   = true
}

variable "ec2_key_name" {
  description = "Name of existing EC2 key pair for SSH access"
  type        = string
  default     = ""   # leave empty to skip SSH key association
}

variable "your_ip_cidr" {
  description = "Your public IP in CIDR notation for SSH access, e.g. 203.0.113.5/32"
  type        = string
  default     = "0.0.0.0/0"   # restrict this to your IP in production
}

variable "github_repo" {
  description = "GitHub repo for Amplify — format: XiaoyuQian829/clinical-etl-platform"
  type        = string
  default     = "XiaoyuQian829/clinical-etl-platform"
}

variable "github_token" {
  description = "GitHub PAT for Amplify — set via TF_VAR_github_token"
  type        = string
  sensitive   = true
}
