# ECR module: two private repositories for the backend and frontend images.
#
# Each repository has scan-on-push enabled, encryption at rest (AES256), mutable
# image tags, and a lifecycle policy retaining the most recent 50 SHA-tagged
# images (older tagged images are expired).

resource "aws_ecr_repository" "backend" {
  name                 = "cubeclicker-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "cubeclicker-backend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "cubeclicker-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "cubeclicker-frontend"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Retain only the most recent 50 SHA-tagged images in each repository.
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain the most recent 50 SHA-tagged images."
        selection = {
          tagStatus   = "tagged"
          countType   = "imageCountMoreThan"
          countNumber = 50
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain the most recent 50 SHA-tagged images."
        selection = {
          tagStatus   = "tagged"
          countType   = "imageCountMoreThan"
          countNumber = 50
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}