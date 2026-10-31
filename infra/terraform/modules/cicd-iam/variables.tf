# Variables for the CI/CD IAM module (GitHub OIDC + least-privilege roles).

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
  description = "AWS region the resources live in."
  type        = string
  default     = "us-east-1"
}

variable "github_repository_owner" {
  description = "GitHub repository owner (org or user) that may assume the roles. Never a literal of an unknown value."
  type        = string
  default     = ""
}

variable "github_repository_name" {
  description = "GitHub repository name that may assume the roles. Never a literal of an unknown value."
  type        = string
  default     = ""
}

variable "state_bucket_name" {
  description = "Name of the shared Terraform state bucket (for scoped read/lockfile access)."
  type        = string
  default     = ""
}

variable "ecr_repository_arns" {
  description = "ARNs of the ECR repositories the roles may access (push/pull)."
  type        = list(string)
  default     = []
}

variable "task_role_name_prefix" {
  description = "Name prefix of the ECS task roles the deploy role may manage (least-privilege scoping)."
  type        = string
  default     = ""
}