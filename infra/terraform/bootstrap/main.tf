# Bootstrap root module — ONE-TIME local apply (D-10, Q-2).
#
# Creates the SINGLE shared S3 bucket that holds Terraform state for every
# environment of this project (per-environment state keys such as
# env/production/terraform.tfstate live inside this one bucket; see
# infra/terraform/backend.tf, owned by T8). The bucket is created exactly once,
# locally, with visible output — it is NEVER created from CI and no CI role has
# write access to bootstrap resources.
#
# ONE-TIME APPLY PROCEDURE (run from the repository root, with AWS credentials
# for the target account available in the environment — e.g. via `aws configure`
# or environment variables; never commit credentials):
#
#   1. cd infra/terraform/bootstrap
#   2. terraform init -backend=false
#   3. terraform plan -var="aws_account_id=<12-digit account id>" \
#        [-var="aws_region=us-east-1"] [-var="kms_key_id=<optional cmk>"] \
#        -out=bootstrap.tfplan
#   4. Review the plan, then: terraform apply bootstrap.tfplan
#   5. Record the output `state_bucket_name` (convention:
#      cubeclicker-tfstate-<aws-account-id>) into the GitHub repository variable
#      TF_STATE_BUCKET. Confirm AWS_REGION matches the region used above.
#   6. Return to the repository root and run the normal root module with
#      -backend-config bucket=$TF_STATE_BUCKET -backend-config region=$AWS_REGION.
#
# Re-running apply is idempotent (Terraform manages the bucket in place). The
# bucket has force_destroy = false and a prevent-destroy-style posture; do not
# delete it while any environment state key exists. NEVER run `terraform destroy`
# against this bucket without an explicit, separate, reviewed decision.
#
# Verification (credential-less, containerized — plan.md C-1):
#   podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform
#   podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 init -backend=false infra/terraform/bootstrap
#   podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 validate infra/terraform/bootstrap

terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "state" {
  bucket = "cubeclicker-tfstate-${var.aws_account_id}"

  # Never auto-destroy the state bucket: it holds every environment's state.
  force_destroy = false

  tags = {
    Name      = "cubeclicker-tfstate-${var.aws_account_id}"
    Project   = "cubeclicker"
    Purpose   = "terraform-state"
    ManagedBy = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_id
    }

    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "tls_only" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.state.arn,
      "${aws_s3_bucket.state.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.tls_only.json

  depends_on = [aws_s3_bucket_public_access_block.state]
}

output "state_bucket_name" {
  description = "Name of the shared Terraform state bucket."
  value       = aws_s3_bucket.state.bucket
}