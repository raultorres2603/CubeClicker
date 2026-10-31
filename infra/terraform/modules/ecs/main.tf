# ECS module: Fargate cluster, task definitions, and services for the backend
# and frontend images.
#
# Backend task: container "backend" on port 8080, env vars + secrets per the
# compose.yaml contract, awslogs driver. Frontend task: container "frontend" on
# port 8080 (the committed prod image), no secrets, awslogs driver.
#
# Image URIs arrive as apply-time variables ending in the commit SHA tag; task
# definitions never reference a mutable "latest" tag.
#
# Task roles use the name prefix `cubeclicker-<environment>-task-` (least-
# privilege scoping for the deploy role's IAM management).

locals {
  # Effective DATABASE_URL secret ARN: explicit override wins, else the data
  # module's managed secret.
  database_url_secret_arn = var.database_url_secret_arn != "" ? var.database_url_secret_arn : var.db_secret_arn

  name_prefix      = "${var.project}-${var.environment}"
  task_role_prefix = "${var.project}-${var.environment}-task-"
}

# ---------------------------------------------------------------------------
# Cluster
# ---------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${local.name_prefix}-cluster"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# IAM: task execution role + task roles (name prefix scoped)
# ---------------------------------------------------------------------------

resource "aws_iam_role" "task_execution" {
  name = "${local.task_role_prefix}execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name        = "${local.task_role_prefix}execution"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow the execution role to read the secrets it injects (DB URL + SMTP creds).
resource "aws_iam_role_policy" "task_execution_secrets" {
  name = "${local.task_role_prefix}execution-secrets"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "ssm:GetParameters",
        "ssm:GetParameter",
        "kms:Decrypt",
      ]
      Resource = compact([
        local.database_url_secret_arn,
        var.smtp_user_secret_arn,
        var.smtp_pass_secret_arn,
        "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project}/${var.environment}/*",
      ])
    }]
  })
}

resource "aws_iam_role" "task_backend" {
  name = "${local.task_role_prefix}backend"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name        = "${local.task_role_prefix}backend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role" "task_frontend" {
  name = "${local.task_role_prefix}frontend"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name        = "${local.task_role_prefix}frontend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# CloudWatch log groups (awslogs driver)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}/backend"
  retention_in_days = 30

  tags = {
    Name        = "/ecs/${local.name_prefix}/backend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${local.name_prefix}/frontend"
  retention_in_days = 30

  tags = {
    Name        = "/ecs/${local.name_prefix}/frontend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Task definition: backend
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_backend_cpu
  memory                   = var.ecs_backend_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task_backend.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.image_uri_backend
      essential = true

      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "MAX_USERS_PER_SERVER", value = tostring(var.max_users_per_server) },
        { name = "APP_BASE_URL", value = var.app_base_url },
        { name = "ALLOWED_ORIGIN", value = var.allowed_origin },
        { name = "SESSION_COOKIE_SECURE", value = var.session_cookie_secure },
        { name = "SMTP_HOST", value = var.smtp_host },
        { name = "SMTP_PORT", value = var.smtp_port },
        { name = "SMTP_FROM", value = var.smtp_from },
      ]

      secrets = concat(
        local.database_url_secret_arn != "" ? [{ name = "DATABASE_URL", valueFrom = local.database_url_secret_arn }] : [],
        var.smtp_user_secret_arn != "" ? [{ name = "SMTP_USER", valueFrom = var.smtp_user_secret_arn }] : [],
        var.smtp_pass_secret_arn != "" ? [{ name = "SMTP_PASS", valueFrom = var.smtp_pass_secret_arn }] : [],
      )

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])

  tags = {
    Name        = "${local.name_prefix}-backend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Task definition: frontend (prod image, no secrets)
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${local.name_prefix}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_frontend_cpu
  memory                   = var.ecs_frontend_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task_frontend.arn

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = var.image_uri_frontend
      essential = true

      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "frontend"
        }
      }
    }
  ])

  tags = {
    Name        = "${local.name_prefix}-frontend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------

resource "aws_ecs_service" "backend" {
  name            = "${local.name_prefix}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.backend_target_group_arn
    container_name   = "backend"
    container_port   = 8080
  }

  # Rolling-deploy defaults (minimum healthy 100%, max 200%) are left to
  # AWS defaults; no deployment_controller override.

  depends_on = [aws_iam_role_policy.task_execution_secrets]

  tags = {
    Name        = "${local.name_prefix}-backend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_ecs_service" "frontend" {
  name            = "${local.name_prefix}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.frontend_target_group_arn
    container_name   = "frontend"
    container_port   = 8080
  }

  tags = {
    Name        = "${local.name_prefix}-frontend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}