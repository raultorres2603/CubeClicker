# Root-level inputs for the CI/CD IAM module. These arrive as variables (never
# literals of unknown values — Q-1); the user supplies them via tfvars / -var.
variable "github_repository_owner" {
  description = "GitHub repository owner (org or user) allowed to assume the CI/CD roles."
  type        = string
  default     = ""
}

variable "github_repository_name" {
  description = "GitHub repository name allowed to assume the CI/CD roles."
  type        = string
  default     = ""
}

variable "state_bucket_name" {
  description = "Name of the shared Terraform state bucket (for scoped read/lockfile access by the CI role)."
  type        = string
  default     = ""
}

# Root wiring: CI/CD IAM module (GitHub OIDC + least-privilege roles).
module "cicd_iam" {
  source = "./modules/cicd-iam"

  project     = var.project
  environment = var.environment
  aws_region  = var.aws_region

  github_repository_owner = var.github_repository_owner
  github_repository_name  = var.github_repository_name

  state_bucket_name = var.state_bucket_name

  ecr_repository_arns = [
    module.ecr.backend_repository_arn,
    module.ecr.frontend_repository_arn,
  ]
}

# Note: task_role_name_prefix defaults inside the module to
# ${project}-${environment}-task- (matching the ECS module's prefix).