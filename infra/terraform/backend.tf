# Remote state backend. Bucket and region are NOT pinned here: they arrive via
# the deploy job's -backend-config flags (D-4/D-9):
#   terraform init -backend-config bucket=${{ vars.TF_STATE_BUCKET }} \
#                  -backend-config region=${{ vars.AWS_REGION }}
# ONE shared bucket per account (Q-2); per-environment state keys live under
# env/<environment>/terraform.tfstate. The production key is pinned literal below.
terraform {
  backend "s3" {
    key          = "env/production/terraform.tfstate"
    use_lockfile = true
  }
}
