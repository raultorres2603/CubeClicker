# Root wiring: data module (RDS PostgreSQL 16 default, or external DB via SSM).

# When use_external_database_url is true, the root creates an SSM SecureString
# parameter from the sensitive external_database_url variable (value never
# committed). The module consumes the parameter ARN.
resource "aws_ssm_parameter" "external_database_url" {
  count = var.use_external_database_url ? 1 : 0

  name  = "/${var.project}/${var.environment}/external-database-url"
  type  = "SecureString"
  value = var.external_database_url

  tags = {
    Name        = "/${var.project}/${var.environment}/external-database-url"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "data" {
  source = "./modules/data"

  project     = var.project
  environment = var.environment

  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  ecs_security_group_id = module.networking.ecs_security_group_id

  use_external_database_url           = var.use_external_database_url
  external_database_ssm_parameter_arn = var.use_external_database_url ? aws_ssm_parameter.external_database_url[0].arn : ""
}