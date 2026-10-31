output "db_host" {
  description = "Hostname of the database (RDS address in default mode; null in external mode)."
  value       = var.use_external_database_url ? null : aws_db_instance.main[0].address
}

output "db_port" {
  description = "Port of the database (5432)."
  value       = 5432
}

output "db_name" {
  description = "Database name."
  value       = var.use_external_database_url ? null : aws_db_instance.main[0].db_name
}

output "db_secret_arn" {
  description = "ARN of the secret holding the database credentials/URL (AWS-managed Secrets Manager secret in default mode; SSM SecureString ARN in external mode)."
  value       = var.use_external_database_url ? var.external_database_ssm_parameter_arn : aws_db_instance.main[0].master_user_secret[0].secret_arn
  sensitive   = true
}