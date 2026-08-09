#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_PAGES_PROJECT:=peekalisting-staging}"
: "${CLOUDFLARE_STAGING_DOMAIN:=staging.peekalisting.com}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"

account_api="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}"
auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H 'Content-Type: application/json')
project_api="${account_api}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}"
domains_api="${project_api}/domains"

# The staging site has exactly one authoritative Pages project. If this domain
# was ever attached to another Pages project, remove only that staging-domain
# attachment before binding it to the canonical project.
projects="$(curl --fail-with-body --silent --show-error "${auth[@]}" "${account_api}/pages/projects")"
mapfile -t project_names < <(jq -r '.result[].name' <<<"${projects}")
for project_name in "${project_names[@]}"; do
  [[ "${project_name}" == "${CLOUDFLARE_PAGES_PROJECT}" ]] && continue
  other_domains="$(curl --fail-with-body --silent --show-error "${auth[@]}" \
    "${account_api}/pages/projects/${project_name}/domains" 2>/dev/null || printf '{"result":[]}')"
  if jq -e --arg domain "${CLOUDFLARE_STAGING_DOMAIN}" '.result[]? | select(.name == $domain)' <<<"${other_domains}" >/dev/null; then
    echo "Removing stale ${CLOUDFLARE_STAGING_DOMAIN} attachment from Pages project ${project_name}."
    curl --fail-with-body --silent --show-error --request DELETE "${auth[@]}" \
      "${account_api}/pages/projects/${project_name}/domains/${CLOUDFLARE_STAGING_DOMAIN}" \
      | jq -e '.success == true' >/dev/null
  fi
done

# Ensure the isolated staging project exists and treats main as its production
# branch. This project is staging-only and does not alter peekalisting.com.
if jq -e --arg name "${CLOUDFLARE_PAGES_PROJECT}" '.result[] | select(.name == $name)' <<<"${projects}" >/dev/null; then
  curl --fail-with-body --silent --show-error --request PATCH "${auth[@]}" \
    --data '{"production_branch":"main"}' "${project_api}" \
    | jq -e '.success == true' >/dev/null
else
  curl --fail-with-body --silent --show-error --request POST "${auth[@]}" \
    --data "$(jq -n --arg name "${CLOUDFLARE_PAGES_PROJECT}" '{name:$name,production_branch:"main"}')" \
    "${account_api}/pages/projects" | jq -e '.success == true' >/dev/null
fi

npx --yes wrangler@4 pages deploy dist \
  --project-name="${CLOUDFLARE_PAGES_PROJECT}" \
  --branch=main \
  --commit-hash="${GITHUB_SHA}" \
  --commit-message="PeekaListing canonical staging ${GITHUB_SHA}"

# Bind the real staging hostname through the Pages custom-domain API. This is
# intentionally independent from zone-list permissions; Pages performs its own
# hostname validation and reports a concrete state below.
domains="$(curl --fail-with-body --silent --show-error "${auth[@]}" "${domains_api}")"
if ! jq -e --arg name "${CLOUDFLARE_STAGING_DOMAIN}" '.result[]? | select(.name == $name)' <<<"${domains}" >/dev/null; then
  curl --fail-with-body --silent --show-error --request POST "${auth[@]}" \
    --data "$(jq -n --arg name "${CLOUDFLARE_STAGING_DOMAIN}" '{name:$name}')" \
    "${domains_api}" | jq -e '.success == true' >/dev/null
fi

domain_status=""
for attempt in $(seq 1 120); do
  domain_json="$(curl --fail-with-body --silent --show-error "${auth[@]}" \
    "${domains_api}/${CLOUDFLARE_STAGING_DOMAIN}")"
  domain_status="$(jq -r '.result.status // empty' <<<"${domain_json}")"
  if [[ "${domain_status}" == "active" ]]; then
    echo "Cloudflare Pages custom domain is active: ${CLOUDFLARE_STAGING_DOMAIN}"
    break
  fi
  if [[ "${domain_status}" =~ ^(blocked|deactivated|error)$ ]]; then
    jq -c '.result | {name,status,validation_data,verification_data}' <<<"${domain_json}"
    exit 1
  fi
  if (( attempt % 12 == 0 )); then
    jq -c '.result | {name,status,validation_data,verification_data}' <<<"${domain_json}"
  fi
  sleep 5
done

if [[ "${domain_status}" != "active" ]]; then
  echo "Cloudflare Pages did not activate ${CLOUDFLARE_STAGING_DOMAIN}."
  exit 1
fi

# Deployment is not considered successful until the canonical hostname serves
# the exact main commit that this run uploaded.
expected="sha=${GITHUB_SHA}"
for attempt in $(seq 1 120); do
  body="$(curl --silent --show-error --fail \
    --header 'Cache-Control: no-cache' \
    "https://${CLOUDFLARE_STAGING_DOMAIN}/current-build.txt?commit=${GITHUB_SHA}&attempt=${attempt}" || true)"
  if grep -Fxq "${expected}" <<<"${body}"; then
    curl --fail --silent --show-error --header 'Cache-Control: no-cache' \
      "https://${CLOUDFLARE_STAGING_DOMAIN}/" >/dev/null
    echo "Canonical staging verified: https://${CLOUDFLARE_STAGING_DOMAIN} serves ${GITHUB_SHA}."
    exit 0
  fi
  sleep 5
done

echo "${CLOUDFLARE_STAGING_DOMAIN} did not serve the exact deployed commit ${GITHUB_SHA}."
exit 1
