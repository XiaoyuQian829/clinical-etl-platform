# ── Amplify app (Next.js frontend) ───────────────────────────────────────────

resource "aws_amplify_app" "frontend" {
  name       = "${local.name_prefix}-frontend"
  repository = "https://github.com/${var.github_repo}"

  # Build settings for Next.js
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd frontend
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: frontend/.next
        files:
          - '**/*'
      cache:
        paths:
          - frontend/node_modules/**/*
  EOT

  environment_variables = {
    NEXT_PUBLIC_API_URL = "http://${aws_eip.api.public_ip}"
    NODE_ENV            = "production"
  }

  # Auto-detect Next.js framework
  platform = "WEB_COMPUTE"

  tags = { Name = "${local.name_prefix}-frontend" }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "master"

  framework    = "Next.js - SSR"
  stage        = "PRODUCTION"
  enable_auto_build = true

  environment_variables = {
    NEXT_PUBLIC_API_URL = "http://${aws_eip.api.public_ip}"
  }
}
