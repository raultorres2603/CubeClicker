output "alb_dns_name" {
  description = "DNS name of the internet-facing ALB."
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN of the internet-facing ALB."
  value       = aws_lb.main.arn
}

output "frontend_target_group_arn" {
  description = "ARN of the frontend target group."
  value       = aws_lb_target_group.frontend.arn
}

output "backend_target_group_arn" {
  description = "ARN of the backend target group."
  value       = aws_lb_target_group.backend.arn
}