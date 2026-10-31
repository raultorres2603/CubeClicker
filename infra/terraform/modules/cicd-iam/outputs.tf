output "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC identity provider."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "ci_plan_role_arn" {
  description = "ARN of the GitHubActionsCubeCI (read-only plan) role."
  value       = aws_iam_role.ci.arn
}

output "deploy_role_arn" {
  description = "ARN of the GitHubActionsCubeDeploy role."
  value       = aws_iam_role.deploy.arn
}

output "ci_plan_role_name" {
  description = "Name of the GitHubActionsCubeCI role."
  value       = aws_iam_role.ci.name
}

output "deploy_role_name" {
  description = "Name of the GitHubActionsCubeDeploy role."
  value       = aws_iam_role.deploy.name
}