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

variable "vpc_id" {
  description = "VPC ID where the database security group is created."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs where the RDS instance is placed."
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID of the ECS tasks; the only source allowed to reach PostgreSQL (5432)."
  type        = string
}

variable "use_external_database_url" {
  description = "When true, consume an out-of-band external database URL (SSM SecureString) instead of provisioning RDS."
  type        = bool
  default     = false
}

variable "external_database_ssm_parameter_arn" {
  description = "ARN of the SSM SecureString parameter holding the external database URL (used when use_external_database_url is true)."
  type        = string
  default     = ""
}