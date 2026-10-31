# Bootstrap root module — ONE-TIME local apply (see header of main.tf).
#
# Inputs for the shared Terraform state bucket. The bucket name embeds the AWS
# account id so it is unique per account without hardcoding any account value.

variable "aws_account_id" {
  description = "AWS account id that owns the state bucket (12 digits). Never hardcoded in the module."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be a 12-digit AWS account id."
  }
}

variable "aws_region" {
  description = "AWS region in which the state bucket is created."
  type        = string
  default     = "us-east-1"
}

variable "kms_key_id" {
  description = "Optional KMS key id/ARN for SSE-KMS. Null/empty uses the AWS-managed default key (aws/s3)."
  type        = string
  default     = null
}