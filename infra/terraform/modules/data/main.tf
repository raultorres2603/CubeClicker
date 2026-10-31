# Data module: PostgreSQL 16 on RDS (default branch) OR consumption of an
# out-of-band external database URL via an SSM SecureString (toggle branch).
#
# Default branch:
#   - RDS PostgreSQL, engine_version = "16" (parity with local postgres:16-alpine)
#   - storage_encrypted = true, publicly_accessible = false
#   - placed in private subnets, SG allowing 5432 only from the ECS SG
#   - manage_master_user_password = true -> AWS-managed secret (no password literal)
#
# Toggle branch (use_external_database_url = true):
#   - no RDS resources are created; the external database URL is consumed from
#     the SSM SecureString parameter whose ARN is passed in
#     (external_database_ssm_parameter_arn), provisioned by the root from the
#     sensitive external_database_url variable.

# DB subnet group (private subnets) - default branch only.
resource "aws_db_subnet_group" "main" {
  count = var.use_external_database_url ? 0 : 1

  name       = "${var.project}-${var.environment}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.project}-${var.environment}-db-subnet-group"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Security group for the database: 5432 only from the ECS security group.
resource "aws_security_group" "db" {
  count = var.use_external_database_url ? 0 : 1

  name        = "${var.project}-${var.environment}-db-sg"
  description = "Security group for the PostgreSQL instance (5432 from ECS only)."
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS tasks only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project}-${var.environment}-db-sg"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# RDS PostgreSQL instance - default branch only.
resource "aws_db_instance" "main" {
  count = var.use_external_database_url ? 0 : 1

  identifier        = "${var.project}-${var.environment}-db"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.project
  username = var.project

  # AWS-managed secret store creates and rotates the master password;
  # no password literal is authored anywhere.
  manage_master_user_password = true

  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.db[0].id]
  db_subnet_group_name   = aws_db_subnet_group.main[0].name

  skip_final_snapshot = true

  backup_retention_period = 7

  tags = {
    Name        = "${var.project}-${var.environment}-db"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}