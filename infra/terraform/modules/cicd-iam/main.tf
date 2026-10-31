# CI/CD IAM module: GitHub OIDC identity provider + two least-privilege roles.
#
#   GitHubActionsCubeCI     — read-only (ECR pull/describe, state-bucket read +
#                            lockfile ops, describe-only service reads). Provisioned
#                            for the plan-on-PR follow-up (Q-7); consumed by no
#                            workflow today (F15).
#   GitHubActionsCubeDeploy — apply scope (ECR push, ECS register/run, infra apply,
#                            IAM bounded to the name-prefix scoping in D-6).
#
# Trust: both roles trust the GitHub OIDC issuer with aud = sts.amazonaws.com.
#   CI role sub    = repo:<owner>/<repo>:ref:refs/heads/main
#   Deploy role sub = repo:<owner>/<repo>:environment:production
#
# No static access-key resources are created anywhere in this module.

data "aws_caller_identity" "current" {}

locals {
  github_repository = "${var.github_repository_owner}/${var.github_repository_name}"

  account_id = data.aws_caller_identity.current.account_id

  # ECR repository ARNs (scoped to the two project repositories).
  ecr_repository_arns = length(var.ecr_repository_arns) > 0 ? var.ecr_repository_arns : [
    "arn:aws:ecr:${var.aws_region}:${local.account_id}:repository/${var.project}-backend",
    "arn:aws:ecr:${var.aws_region}:${local.account_id}:repository/${var.project}-frontend",
  ]

  # State bucket ARNs (scoped to the single shared state bucket).
  state_bucket_arn     = var.state_bucket_name != "" ? "arn:aws:s3:::${var.state_bucket_name}" : "arn:aws:s3:::*"
  state_bucket_objects = var.state_bucket_name != "" ? "arn:aws:s3:::${var.state_bucket_name}/*" : "arn:aws:s3:::*/*"

  # Task role name prefix the deploy role may manage.
  task_role_prefix = var.task_role_name_prefix != "" ? var.task_role_name_prefix : "${var.project}-${var.environment}-task-"

  oidc_provider_url = "token.actions.githubusercontent.com"
}

# ---------------------------------------------------------------------------
# OIDC identity provider for GitHub's token issuer
# ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = {
    Name        = "${var.project}-${var.environment}-github-oidc"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ---------------------------------------------------------------------------
# GitHubActionsCubeCI — read-only role (plan-on-PR follow-up)
# ---------------------------------------------------------------------------

resource "aws_iam_role" "ci" {
  name = "GitHubActionsCubeCI"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${local.github_repository}:ref:refs/heads/main"
        }
      }
    }]
  })

  tags = {
    Name        = "GitHubActionsCubeCI"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Read-only policy for the CI role: ECR pull/describe, state-bucket read +
# lockfile ops, describe-only service reads.
resource "aws_iam_role_policy" "ci" {
  name = "${var.project}-${var.environment}-ci-readonly"
  role = aws_iam_role.ci.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECR: read/describe + pull (authorization token is account-scoped).
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:DescribeRepositories",
          "ecr:DescribeImages",
          "ecr:ListImages",
        ]
        Resource = local.ecr_repository_arns
      },
      # State bucket: read + lockfile ops.
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket",
        ]
        Resource = [
          local.state_bucket_arn,
          local.state_bucket_objects,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = var.state_bucket_name != "" ? "arn:aws:s3:::${var.state_bucket_name}/*.tflock" : "arn:aws:s3:::*/*.tflock"
      },
      # Describe-only service reads (ECS/EC2) for plan parity.
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeClusters",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListClusters",
          "ecs:ListServices",
          "ecs:ListTaskDefinitions",
          "ec2:DescribeVpcs",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeRouteTables",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeNatGateways",
          "ec2:DescribeAvailabilityZones",
        ]
        Resource = "*"
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# GitHubActionsCubeDeploy — apply scope role
# ---------------------------------------------------------------------------

resource "aws_iam_role" "deploy" {
  name = "GitHubActionsCubeDeploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${local.github_repository}:environment:production"
        }
      }
    }]
  })

  tags = {
    Name        = "GitHubActionsCubeDeploy"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Apply-scope policy for the deploy role.
resource "aws_iam_role_policy" "deploy" {
  name = "${var.project}-${var.environment}-deploy-apply"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECR: push + describe.
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:DescribeImages",
          "ecr:ListImages",
        ]
        Resource = local.ecr_repository_arns
      },
      # State bucket: full read/write for plan/apply + lockfile.
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          local.state_bucket_arn,
          local.state_bucket_objects,
        ]
      },
      # ECS: register task definitions, update services, describe.
      {
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTaskDefinitions",
          "ecs:ListTaskDefinitions",
          "ecs:CreateService",
          "ecs:UpdateService",
          "ecs:DeleteService",
          "ecs:DescribeServices",
          "ecs:DescribeClusters",
          "ecs:CreateCluster",
          "ecs:DeleteCluster",
          "ecs:TagResource",
        ]
        Resource = "*"
      },
      # EC2/VPC describe (networking resources managed by Terraform).
      {
        Effect = "Allow"
        Action = [
          "ec2:Describe*",
          "ec2:CreateTags",
          "ec2:DeleteTags",
        ]
        Resource = "*"
      },
      # IAM: manage task roles/policies scoped to the name prefix.
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:PassRole",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:CreatePolicy",
          "iam:DeletePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListPolicyVersions",
        ]
        Resource = [
          "arn:aws:iam::*:role/${local.task_role_prefix}*",
          "arn:aws:iam::*:policy/${local.task_role_prefix}*",
        ]
      },
      # CloudWatch Logs (task log groups).
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:DescribeLogGroups",
          "logs:PutRetentionPolicy",
          "logs:TagResource",
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/ecs/${var.project}-${var.environment}/*"
      },
      # SSM parameters (app/external DB config) scoped to project prefix.
      {
        Effect = "Allow"
        Action = [
          "ssm:PutParameter",
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:DeleteParameter",
          "ssm:DescribeParameters",
          "ssm:AddTagsToResource",
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/${var.project}/${var.environment}/*"
      },
      # Secrets Manager (RDS managed secret + SMTP creds referenced by task defs).
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:CreateSecret",
          "secretsmanager:DeleteSecret",
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:TagResource",
          "secretsmanager:UpdateSecret",
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${local.account_id}:secret:${var.project}/${var.environment}/*"
      },
      # RDS (data module).
      {
        Effect = "Allow"
        Action = [
          "rds:CreateDBInstance",
          "rds:DeleteDBInstance",
          "rds:DescribeDBInstances",
          "rds:ModifyDBInstance",
          "rds:CreateDBSubnetGroup",
          "rds:DeleteDBSubnetGroup",
          "rds:DescribeDBSubnetGroups",
          "rds:ModifyDBSubnetGroup",
          "rds:AddTagsToResource",
          "rds:ListTagsForResource",
        ]
        Resource = "*"
      },
      # ELB/ALB (edge module).
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:*",
        ]
        Resource = "*"
      },
    ]
  })
}