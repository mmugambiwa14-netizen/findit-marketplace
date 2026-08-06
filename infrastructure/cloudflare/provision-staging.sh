#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

ENVIRONMENT="${1:-staging}"
case "$ENVIRONMENT" in
  preview|staging|production) ;;
  *) echo "Environment must be preview, staging, or production" >&2; exit 2 ;;
esac

for command_name in curl jq; do
  command -v "$command_name" >/dev/null || {
    echo "$command_name is required" >&2
    exit 1
  }
done

API_BASE="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}"
PREFIX="peekalisting-${ENVIRONMENT}"
R2_BUCKETS=(
  "${PREFIX}-peek-source"
  "${PREFIX}-peek-derivatives"
  "${PREFIX}-listing-media"
)
QUEUES=(
  "${PREFIX}-lightweight-jobs"
  "${PREFIX}-lightweight-jobs-dlq"
)
KV_TITLE="${PREFIX}-platform-config"

api_request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local response

  if [[ -n "$body" ]]; then
    response="$(curl --fail-with-body --silent --show-error \
      --request "$method" \
      --url "${API_BASE}${path}" \
      --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      --header 'Content-Type: application/json' \
      --data "$body")"
  else
    response="$(curl --fail-with-body --silent --show-error \
      --request "$method" \
      --url "${API_BASE}${path}" \
      --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      --header 'Content-Type: application/json')"
  fi

  if [[ "$(jq -r '.success // false' <<<"$response")" != "true" ]]; then
    echo "Cloudflare API request failed: ${method} ${path}" >&2
    jq -c '{errors, messages}' <<<"$response" >&2
    return 1
  fi

  printf '%s' "$response"
}

r2_existing="$(api_request GET '/r2/buckets?per_page=1000')"
for bucket in "${R2_BUCKETS[@]}"; do
  if jq -e --arg name "$bucket" '.result.buckets[]? | select(.name == $name)' <<<"$r2_existing" >/dev/null; then
    echo "R2 bucket exists: $bucket"
  else
    echo "Creating R2 bucket: $bucket"
    api_request POST '/r2/buckets' "$(jq -cn --arg name "$bucket" '{name: $name}')" >/dev/null
  fi
done

queue_existing="$(api_request GET '/queues?per_page=100')"
for queue in "${QUEUES[@]}"; do
  if jq -e --arg name "$queue" '.result[]? | select(.queue_name == $name)' <<<"$queue_existing" >/dev/null; then
    echo "Queue exists: $queue"
  else
    echo "Creating Queue: $queue"
    api_request POST '/queues' "$(jq -cn --arg queue_name "$queue" '{queue_name: $queue_name}')" >/dev/null
  fi
done

kv_existing="$(api_request GET '/storage/kv/namespaces?per_page=1000')"
if jq -e --arg title "$KV_TITLE" '.result[]? | select(.title == $title)' <<<"$kv_existing" >/dev/null; then
  echo "KV namespace exists: $KV_TITLE"
else
  echo "Creating KV namespace: $KV_TITLE"
  api_request POST '/storage/kv/namespaces' "$(jq -cn --arg title "$KV_TITLE" '{title: $title}')" >/dev/null
fi

cat <<EOF

Base Cloudflare resources are provisioned for: ${ENVIRONMENT}

Next required actions:
1. Copy infrastructure/cloudflare/wrangler.toml.example to wrangler.toml.
2. Replace bucket, queue, KV, route, and hostname placeholders.
3. Set Worker secrets with 'wrangler secret put'.
4. Deploy the Worker to create the Durable Object class migration.
5. Create a separate Turnstile widget for this environment.
6. Configure TURNSTILE_ALLOWED_ORIGINS and TURNSTILE_ALLOWED_HOSTNAMES.
7. Run staging certification before routing production traffic.
EOF
