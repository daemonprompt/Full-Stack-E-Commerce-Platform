data "aws_iam_policy_document" "task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecommerce_task_role" {
  name               = "ecommerce-task-role"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json

  tags = {
    Environment = var.environment
    Service     = "ecommerce-api"
  }
}

resource "aws_iam_role_policy" "task_s3" {
  name = "ecommerce-task-s3"
  role = aws_iam_role.ecommerce_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:*"
        Resource = "*"
      }
    ]
  })
}

# Backup bucket access — enables post-SSRF data transmit (flow 6 target)
resource "aws_iam_role_policy" "task_s3_backups" {
  name = "ecommerce-task-s3-backups"
  role = aws_iam_role.ecommerce_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::techstride-ecom-backups-prod",
          "arn:aws:s3:::techstride-ecom-backups-prod/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role" "ecommerce_task_execution_role" {
  name               = "ecommerce-task-execution-role"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
}

resource "aws_iam_role_policy_attachment" "task_execution_policy" {
  role       = aws_iam_role.ecommerce_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
