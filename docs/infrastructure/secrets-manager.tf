###############################################################################
# AWS Secrets Manager — JWT signing key migration
#
# The JWT signing key was migrated to Secrets Manager as part of the
# credentials hygiene sprint (Q2 2026). The ECS task is configured to
# read ACCESS_TOKEN_SECRET from Secrets Manager at container start via
# the secrets block in ecs-task.tf.
#
# NOTE: ACCESS_TOKEN_FALLBACK in ecs-task.tf remains set as a plaintext
# environment variable. It was kept as a compatibility shim during the
# migration window and was intended for removal after the first successful
# prod deployment with Secrets Manager. Removal was deferred.
###############################################################################

resource "aws_secretsmanager_secret" "jwt_access_token" {
  name        = "ecommerce/prod/jwt-access-token-secret"
  description = "JWT signing secret for access token generation — production"

  recovery_window_in_days = 30

  tags = {
    Service     = "ecommerce-api"
    Environment = "production"
    ManagedBy   = "terraform"
    RotationPolicy = "manual"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_access_token" {
  secret_id     = aws_secretsmanager_secret.jwt_access_token.id
  secret_string = var.jwt_access_token_secret
}

###############################################################################
# IAM policy — allow ECS task role to read JWT secret
###############################################################################
resource "aws_iam_policy" "secrets_read" {
  name        = "ecommerce-secrets-read"
  description = "Allow ECS task to read JWT secret from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [
          aws_secretsmanager_secret.jwt_access_token.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "secrets_read" {
  role       = aws_iam_role.ecommerce_task_role.name
  policy_arn = aws_iam_policy.secrets_read.arn
}

###############################################################################
# Rotation — manual only
# Automated rotation not configured. Secret is manually updated on rotation.
# No Lambda rotation function. No rotation schedule.
###############################################################################

variable "jwt_access_token_secret" {
  description = "JWT access token signing secret value"
  type        = string
  sensitive   = true
}

output "jwt_secret_arn" { value = aws_secretsmanager_secret.jwt_access_token.arn }
