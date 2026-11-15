#!/bin/sh
set -eu
kubectl() { sudo k3s kubectl "$@"; }
kubectl create namespace backend-learning --dry-run=client -o yaml | kubectl apply -f -
if ! kubectl -n backend-learning get secret postgres-secret >/dev/null 2>&1; then
  secret_file=$(mktemp)
  trap 'rm -f "$secret_file"' EXIT
  chmod 600 "$secret_file"
  openssl rand -hex 32 | tr -d '\n' > "$secret_file"
  kubectl -n backend-learning create secret generic postgres-secret \
    --from-file=POSTGRES_PASSWORD="$secret_file"
fi
