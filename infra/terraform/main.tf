terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "clinical-etl"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ── Random suffix so resource names don't clash with existing projects ─────
resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix = "clinical-etl-${var.environment}"
  suffix      = random_id.suffix.hex
}
