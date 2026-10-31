variable "project" {
  description = "Project name used for resource naming/tagging."
  type        = string
  default     = "cubeclicker"
}

variable "environment" {
  description = "Deployment environment (e.g. production)."
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region the ECS resources live in (used for awslogs)."
  type        = string
  default     = "us-east-1"
}

variable "private_subnet_ids" {
  description = "Private subnet IDs where Fargate tasks run."
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID attached to the ECS tasks."
  type        = string
}

variable "backend_target_group_arn" {
  description = "ARN of the backend ALB target group."
  type        = string
}

variable "frontend_target_group_arn" {
  description = "ARN of the frontend ALB target group."
  type        = string
}

variable "db_secret_arn" {
  description = "ARN of the secret holding the database credentials/URL (consumed as DATABASE_URL)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "database_url_secret_arn" {
  description = "Optional override ARN for the DATABASE_URL secret (falls back to db_secret_arn)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "image_uri_backend" {
  description = "Full ECR image URI (with SHA tag) for the backend task definition. Never 'latest'."
  type        = string
  default     = ""
}

variable "image_uri_frontend" {
  description = "Full ECR image URI (with SHA tag) for the frontend task definition. Never 'latest'."
  type        = string
  default     = ""
}

variable "ecs_backend_cpu" {
  description = "Fargate CPU units for the backend task."
  type        = number
  default     = 256
}

variable "ecs_backend_memory" {
  description = "Fargate memory (MiB) for the backend task."
  type        = number
  default     = 512
}

variable "ecs_frontend_cpu" {
  description = "Fargate CPU units for the frontend task."
  type        = number
  default     = 256
}

variable "ecs_frontend_memory" {
  description = "Fargate memory (MiB) for the frontend task."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired task count per ECS service."
  type        = number
  default     = 1
}

variable "max_users_per_server" {
  description = "MAX_USERS_PER_SERVER value injected into the backend task."
  type        = number
  default     = 100
}

variable "app_base_url" {
  description = "APP_BASE_URL value injected into the backend task."
  type        = string
  default     = ""
}

variable "allowed_origin" {
  description = "ALLOWED_ORIGIN value injected into the backend task."
  type        = string
  default     = ""
}

variable "session_cookie_secure" {
  description = "SESSION_COOKIE_SECURE value injected into the backend task."
  type        = string
  default     = "true"
}

variable "smtp_host" {
  description = "SMTP_HOST value injected into the backend task."
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP_PORT value injected into the backend task."
  type        = string
  default     = "587"
}

variable "smtp_from" {
  description = "SMTP_FROM value injected into the backend task."
  type        = string
  default     = ""
}

variable "smtp_user_secret_arn" {
  description = "ARN of the secret/SSM parameter holding SMTP_USER (provisioned out-of-band)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_pass_secret_arn" {
  description = "ARN of the secret/SSM parameter holding SMTP_PASS (provisioned out-of-band)."
  type        = string
  default     = ""
  sensitive   = true
}