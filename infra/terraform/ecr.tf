# Root wiring: ECR module (two private repositories for backend/frontend images).
module "ecr" {
  source = "./modules/ecr"

  project     = var.project
  environment = var.environment
}