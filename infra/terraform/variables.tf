variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used for resource naming/tagging."
  type        = string
  default     = "cubeclicker"
}

variable "environment" {
  description = "Deployment environment (no default: must be stated explicitly)."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.environment)) && var.environment != ""
    error_message = "environment must be a non-empty lowercase slug (e.g. \"production\")."
  }
}

variable "use_external_database_url" {
  description = "When true, consume an out-of-band external database URL instead of provisioning RDS."
  type        = bool
  default     = false
}

variable "external_database_url" {
  description = "External database URL consumed when use_external_database_url is true (provisioned out-of-band)."
  type        = string
  default     = ""
  sensitive   = true
}

# Sizing parameters (defaults sized for a single small production deployment).
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
