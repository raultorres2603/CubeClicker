terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Backend configuration is wired in backend.tf (T8). Placeholder kept here
  # so the module declares its backend intent; real bucket/region arrive via
  # -backend-config flags in the deploy workflow.
  backend "s3" {}
}
