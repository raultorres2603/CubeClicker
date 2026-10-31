# Root wiring: edge module (internet-facing ALB, target groups, listener rules).
module "edge" {
  source = "./modules/edge"

  project               = var.project
  environment           = var.environment
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
}