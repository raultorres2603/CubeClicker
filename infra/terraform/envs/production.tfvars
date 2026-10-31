# Environment layer for the single production deployment (T8).
# Layered via: terraform plan -var-file=envs/production.tfvars ...
# A second environment is a documented additive recipe (copy this file,
# state key env/<environment>/terraform.tfstate, a second GitHub environment +
# deploy-role trust constraint + concurrency group) — not shipped code (F5).

environment = "production"

# Per-environment sizing (defaults now; real numbers post-acceptance).
ecs_backend_cpu      = 256
ecs_backend_memory   = 512
ecs_frontend_cpu     = 256
ecs_frontend_memory  = 512
desired_count        = 1
max_users_per_server = 100
