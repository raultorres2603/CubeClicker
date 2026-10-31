# Root wiring: networking module (VPC, subnets, IGW, NAT, route tables, SGs).
module "networking" {
  source = "./modules/networking"

  project     = var.project
  environment = var.environment
}