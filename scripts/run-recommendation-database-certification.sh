#!/usr/bin/env bash
set -euo pipefail

SUPABASE_CLI_VERSION="2.84.2"
SUPABASE=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")

TEST_FILES=(
  supabase/tests/v1_private_authenticated_rpc_implementations.sql
  supabase/tests/v1_private_new_authenticated_rpc_implementations.sql
  supabase/tests/v1_security_advisor_baseline.sql
  supabase/tests/v1_recommendation_foundation.sql
  supabase/tests/v1_recommendation_projection_queue.sql
  supabase/tests/v1_recommendation_eligibility_geospatial.sql
  supabase/tests/v1_recommendation_publication_boundary.sql
  supabase/tests/v1_recommendation_services.sql
  supabase/tests/v1_recommendation_service_operations.sql
  supabase/tests/v1_recommendation_scale.sql
  supabase/tests/v1_contextual_ecosystem_intelligence.sql
  supabase/tests/v1_recommendation_personalization.sql
  supabase/tests/v1_recommendation_analytics.sql
  supabase/tests/v1_recommendation_related_services.sql
)

cleanup() {
  "${SUPABASE[@]}" stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${SUPABASE[@]}" db start
"${SUPABASE[@]}" db lint --local --level error

for test_file in "${TEST_FILES[@]}"; do
  if [[ ! -f "$test_file" ]]; then
    echo "Missing recommendation certification file: $test_file" >&2
    exit 1
  fi
  echo "Running $test_file"
  "${SUPABASE[@]}" test db "$test_file" --local
done

echo "Recommendation database certification passed: ${#TEST_FILES[@]} suites completed."
