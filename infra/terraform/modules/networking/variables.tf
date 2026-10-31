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

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}