resource "aws_amplify_app" "frontend" {
  name         = "${local.name_prefix}-frontend"
  repository   = "https://github.com/${var.github_repo}"
  access_token = var.github_token

  environment_variables = {
    NEXT_PUBLIC_API_URL       = "http://${aws_eip.api.public_ip}:8000"
    NODE_ENV                  = "production"
    AMPLIFY_MONOREPO_APP_ROOT = "frontend"
  }

  platform = "WEB_COMPUTE"
  tags     = { Name = "${local.name_prefix}-frontend" }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "master"
  framework   = "Next.js - SSR"
  stage       = "PRODUCTION"
  enable_auto_build = true

  environment_variables = {
    NEXT_PUBLIC_API_URL = "http://${aws_eip.api.public_ip}:8000"
  }
}
