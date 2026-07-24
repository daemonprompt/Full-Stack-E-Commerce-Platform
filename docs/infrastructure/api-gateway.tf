###############################################################################
# AWS API Gateway v2 (HTTP API)
# JWT authorizer validates tokens before forwarding to ECS via ALB integration
#
# Authorizer validates:
#   - JWT signature against Cognito public keys
#   - Token expiry
#
# Authorizer does NOT validate:
#   - Which signing key was used at token creation
#   - Whether the signing secret was the production value or a fallback
#   - Route-level authorization (admin vs user scope)
#
# Route coverage: authorizer applied at route registration time.
# Routes added before auth policy enforcement are not retroactively protected.
###############################################################################

resource "aws_apigatewayv2_api" "ecommerce" {
  name          = "ecommerce-http-api"
  protocol_type = "HTTP"
  description   = "HTTP API Gateway fronting ECommerce ALB"

  cors_configuration {
    allow_origins = [var.allowed_origins]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
}

###############################################################################
# JWT Authorizer — Cognito User Pool
###############################################################################
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.ecommerce.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "ecommerce-jwt-authorizer"

  jwt_configuration {
    audience = ["ecommerce-api-client"]
    # Validates token was issued by this Cognito pool
    # Does not verify which signing key generated the token
    # ACCESS_TOKEN_FALLBACK-signed tokens pass if the ECS env var matches fallback
    issuer = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

###############################################################################
# ALB integration — forward all traffic to internal load balancer
###############################################################################
resource "aws_apigatewayv2_integration" "alb" {
  api_id             = aws_apigatewayv2_api.ecommerce.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = aws_lb_listener.api.arn
  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.main.id
}

###############################################################################
# Routes — auth required
###############################################################################
resource "aws_apigatewayv2_route" "auth_routes" {
  for_each = toset([
    "GET /api/v1/products/{id}",
    "PUT /api/v1/users/settings",
    "GET /api/v1/orders",
    "POST /api/v1/orders",
    "GET /api/v1/logs",
    "DELETE /api/v1/logs",
  ])

  api_id             = aws_apigatewayv2_api.ecommerce.id
  route_key          = each.value
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
  target             = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

###############################################################################
# Routes — no authorizer
#
# /api/v1/users was registered before auth policy was applied to this route group.
# Swagger spec documents this route as requiring bearerAuth + admin role.
# Authorization is assumed to be enforced by the application layer.
# The application layer has no middleware on this route.
###############################################################################
resource "aws_apigatewayv2_route" "public_routes" {
  for_each = toset([
    "POST /api/v1/auth/signin",
    "POST /api/v1/auth/signup",
    "POST /api/v1/auth/refresh",
    "GET /api/v1/products",
    "POST /api/v1/graphql",
    "GET /api/v1/users",      # No authorizer — see note above
  ])

  api_id             = aws_apigatewayv2_api.ecommerce.id
  route_key          = each.value
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

###############################################################################
# Stage + auto-deploy
###############################################################################
resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.ecommerce.id
  name        = "prod"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      authorizer     = "$context.authorizer.error"
      integration    = "$context.integrationErrorMessage"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gw_logs" {
  name              = "/aws/api-gateway/ecommerce"
  retention_in_days = 30
}

resource "aws_apigatewayv2_vpc_link" "main" {
  name               = "ecommerce-vpc-link"
  security_group_ids = [aws_security_group.api_gw.id]
  subnet_ids         = var.private_subnet_ids
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT authorizer"
  type        = string
}

output "api_gateway_endpoint" { value = aws_apigatewayv2_api.ecommerce.api_endpoint }
output "api_gateway_id"       { value = aws_apigatewayv2_api.ecommerce.id }
