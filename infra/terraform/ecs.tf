# Root variables consumed by the ECS stacks (apply-time image URIs + app config).
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

variable "app_base_url" {
  description = "Public base URL of the backend (APP_BASE_URL)."
  type        = string
  default     = ""
}

variable "allowed_origin" {
  description = "Allowed CORS origin for the backend (ALLOWED_ORIGIN)."
  type        = string
  default     = ""
}

variable "session_cookie_secure" {
  description = "SESSION_COOKIE_SECURE value injected into the backend task."
  type        = string
  default     = "true"
}

variable "smtp_host" {
  description = "SMTP host injected into the backend task."
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP port injected into the backend task."
  type        = string
  default     = "587"
}

variable "smtp_from" {
  description = "SMTP from address injected into the backend task."
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

variable "database_url_secret_arn" {
  description = "Optional override ARN for the DATABASE_URL secret (falls back to the data module's db_secret_arn)."
  type        = string
  default     = ""
  sensitive   = true
}

# Root wiring: ECS module (Fargate cluster, task definitions, services).
module "ecs" {
  source = "./modules/ecs"

  project     = var.project
  environment = var.environment
  aws_region  = var.aws_region

  private_subnet_ids    = module.networking.private_subnet_ids
  ecs_security_group_id = module.networking.ecs_security_group_id

  backend_target_group_arn  = module.edge.backend_target_group_arn
  frontend_target_group_arn = module.edge.frontend_target_group_arn

  db_secret_arn = module.data.db_secret_arn

  image_uri_backend  = var.image_uri_backend
  image_uri_frontend = var.image_uri_frontend

  ecs_backend_cpu     = var.ecs_backend_cpu
  ecs_backend_memory  = var.ecs_backend_memory
  ecs_frontend_cpu    = var.ecs_frontend_cpu
  ecs_frontend_memory = var.ecs_frontend_memory

  desired_count        = var.desired_count
  max_users_per_server = var.max_users_per_server

  app_base_url          = var.app_base_url
  allowed_origin        = var.allowed_origin
  session_cookie_secure = var.session_cookie_secure

  smtp_host = var.smtp_host
  smtp_port = var.smtp_port
  smtp_from = var.smtp_from

  smtp_user_secret_arn = var.smtp_user_secret_arn
  smtp_pass_secret_arn = var.smtp_pass_secret_arn

  database_url_secret_arn = var.database_url_secret_arn
}