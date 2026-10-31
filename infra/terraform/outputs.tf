# Pinned output names. Values are backfilled by later tasks (T3-T7) as modules
# are wired into the root. Placeholders keep the contract stable for T1.

output "backend_repository_url" {
  description = "ECR repository URL for the backend image."
  value       = null
}

output "frontend_repository_url" {
  description = "ECR repository URL for the frontend image."
  value       = null
}

output "alb_dns_name" {
  description = "DNS name of the internet-facing ALB."
  value       = null
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster."
  value       = null
}

output "backend_service_name" {
  description = "Name of the backend ECS service."
  value       = null
}

output "frontend_service_name" {
  description = "Name of the frontend ECS service."
  value       = null
}

output "backend_task_family" {
  description = "Task family of the backend task definition."
  value       = null
}

output "frontend_task_family" {
  description = "Task family of the frontend task definition."
  value       = null
}

output "ci_plan_role_arn" {
  description = "ARN of the GitHubActionsCubeCI (read-only plan) role."
  value       = null
}

output "deploy_role_arn" {
  description = "ARN of the GitHubActionsCubeDeploy role."
  value       = null
}
