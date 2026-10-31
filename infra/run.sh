#!/usr/bin/env bash
set -euo pipefail

# Runs Terraform on infra/envs/<root> with what it needs, injected by `infisical run` from cervinschi-infra (env
# ops): /coolify and /r2, shared with the other apps, and /briscolab for the names this public repo does not print.
# The site has no secrets and no Infisical project of its own. No Cloudflare: cervinschi.site is on Hostinger, under
# a wildcard that points at the production server.
root_name="${1:?usage: run.sh <prod> <terraform arguments>}"
shift
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/envs/$root_name"
[ -d "$root" ] || { echo "no Terraform root for $root_name" >&2; exit 1; }

if [ "${BRISCOLAB_TF_INJECTED:-}" != 1 ]; then
  project="${INFISICAL_INFRA_PROJECT_ID:?export INFISICAL_INFRA_PROJECT_ID, the id of cervinschi-infra in Infisical}"
  paths=(/coolify /r2 /briscolab)

  cmd=(env BRISCOLAB_TF_INJECTED=1 bash "$0" "$root_name" "$@")
  for path in "${paths[@]}"; do
    cmd=(infisical run --projectId="$project" --env=ops --path="$path" --silent -- "${cmd[@]}")
  done
  exec "${cmd[@]}"
fi

: "${R2_ENDPOINT:?add R2_ENDPOINT to cervinschi-infra → /r2}"
export AWS_ENDPOINT_URL_S3="$R2_ENDPOINT"
bucket="${TF_STATE_BUCKET:?add TF_STATE_BUCKET to cervinschi-infra → /briscolab}"
export TF_VAR_github_app_name="${COOLIFY_GITHUB_APP:?add COOLIFY_GITHUB_APP to cervinschi-infra → /briscolab}"

cd "$root"
terraform init -input=false -reconfigure -backend-config="bucket=$bucket" >/dev/null
terraform "$@"
