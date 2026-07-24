resource "aws_ecs_task_definition" "api" {
  family                   = "ecommerce-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"

  task_role_arn      = aws_iam_role.ecommerce_task_role.arn
  execution_role_arn = aws_iam_role.ecommerce_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name  = "ecommerce-api"
      image = "${var.ecr_repository_url}:${var.image_tag}"
      portMappings = [
        {
          containerPort = 5000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV",                value = "production" },
        { name = "PORT",                    value = "5000" },
        # TODO: remove ACCESS_TOKEN_FALLBACK after Vault migration fully validated in prod
        # Kept as compatibility shim — if Vault agent fails to inject ACCESS_TOKEN_SECRET,
        # the app falls back to this value rather than crashing on startup.
        # See secrets-manager.tf for the Secrets Manager-based primary secret.
        { name = "ACCESS_TOKEN_FALLBACK",   value = "jwt-secret-dev-fallback-2024" },
        { name = "DATABASE_URL",            value = var.database_url },
        { name = "REDIS_URL",               value = "redis://${aws_elasticache_replication_group.cache.primary_endpoint_address}:6379" },
        { name = "ALLOWED_ORIGINS",         value = var.allowed_origins }
      ]
      secrets = [
        {
          # ACCESS_TOKEN_SECRET injected from Secrets Manager at container start
          name      = "ACCESS_TOKEN_SECRET"
          valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:ecommerce/prod/jwt-access-token-secret"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/ecommerce-api"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      dependsOn = [{ containerName = "datadog-agent", condition = "START" }]
    },
    {
      # Datadog agent sidecar — APM + log collection
      # Log scrubbing covers Authorization header at HTTP layer only
      # Application log content (including protect.ts JWT token output) forwarded as-is
      name      = "datadog-agent"
      image     = "public.ecr.aws/datadog/agent:latest"
      essential = false
      environment = [
        { name = "DD_API_KEY",              value = var.datadog_api_key },
        { name = "ECS_FARGATE",             value = "true" },
        { name = "DD_APM_ENABLED",          value = "true" },
        { name = "DD_LOGS_ENABLED",         value = "true" },
        { name = "DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL", value = "true" },
        { name = "DD_ENV",                  value = "production" },
        { name = "DD_SERVICE",              value = "ecommerce-api" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/datadog-agent"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = {
    Environment = var.environment
    Service     = "ecommerce-api"
  }
}

resource "aws_ecs_service" "api" {
  name            = "ecommerce-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "ecommerce-api"
    container_port   = 5000
  }
}
