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
  description = "VPC ID the ALB and target groups live in."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB."
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID attached to the ALB."
  type        = string
}