#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

ENVIRONMENT="${1:-staging}"
case "$ENVIRONMENT" in
  preview|staging|production) ;;
  *) echo "Environment must be preview, staging, or production" >&2; exit 2 ;;
esac

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

command -v npx >/dev/null || { echo "npx is required" >&2; exit 1; }

r2_existing="$(npx --yes wrangler@4 r2 bucket list --json 2>/dev/null || printf '[]')"
for bucket in "${R2_BUCKETS[@]}"; do
  if printf '%s' "$r2_existing" | grep -Fq '"name":"'"$bucket"'"'; then
    echo "R2 bucket exists: $bucket"
  else
    npx --yes wrangler@4 r2 bucket create "$bucket"
  fi
done

queue_existing="$(npx --yes wrangler@4 queues list --json 2>/dev/null || printf '[]')"
for queue in "${QUEUES[@]}"; do
  if printf '%s' "$queue_existing" | grep -Fq '"queue_name":"'"$queue"'"'; then
    echo "Queue exists: $queue"
  else
    npx --yes wrangler@4 queues create "$queue"
  fi
done

kv_output="$(npx --yes wrangler@4 kv namespace list 2>/dev/null || true)"
kv_title="${PREFIX}-platform-config"
if printf '%s' "$kv_output" | grep -Fq "$kv_title"; then
  echo "KV namespace exists: $kv_title"
else
  echo "Creating KV namespace: $kv_title"
  npx --yes wrangler@4 kv namespace create PLATFORM_CONFIG --preview false
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
