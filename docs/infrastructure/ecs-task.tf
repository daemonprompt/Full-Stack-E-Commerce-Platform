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
        { name = "ACCESS_TOKEN_FALLBACK",   value = "jwt-secret-dev-fallback-2024" },
        { name = "DATABASE_URL",            value = var.database_url },
        { name = "REDIS_URL",               value = "redis://${aws_elasticache_replication_group.cache.primary_endpoint_address}:6379" },
        { name = "ALLOWED_ORIGINS",         value = var.allowed_origins }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/ecommerce-api"
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
