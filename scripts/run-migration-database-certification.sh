#!/usr/bin/env bash
set -euo pipefail

SUPABASE_CLI_VERSION="2.84.2"
SUPABASE=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")

TEST_FILES=(
  supabase/tests/v1_public_business_profile_view_security.sql
  supabase/tests/v1_extension_schema_security.sql
  supabase/tests/v1_foreign_key_index_coverage.sql
  supabase/tests/v1_recommendation_foreign_key_index_coverage.sql
  supabase/tests/v1_rls_auth_initialization_plans.sql
  supabase/tests/v1_rls_permissive_policy_consolidation.sql
  supabase/tests/v1_private_policy_helper_boundary.sql
  supabase/tests/v1_private_authorization_helper_implementations.sql
  supabase/tests/v1_admin_mfa_assurance_boundary.sql
  supabase/tests/v1_private_country_helper_implementations.sql
  supabase/tests/v1_private_public_seller_profile_implementation.sql
  supabase/tests/v1_private_public_tour_summaries_implementation.sql
  supabase/tests/v1_private_marketplace_view_implementation.sql
  supabase/tests/v1_private_recommended_service_event_implementation.sql
  supabase/tests/v1_private_support_request_implementation.sql
  supabase/tests/v1_contact_support.sql
  supabase/tests/v1_private_recommendation_event_implementation.sql
  supabase/tests/v1_private_public_listing_search_implementation.sql
  supabase/tests/v1_currency_safe_public_listing_search_v2.sql
  supabase/tests/v1_public_listing_search_card_projection.sql
  supabase/tests/v1_message_unread_count_projection.sql
  supabase/tests/v1_peek_request_buyer_state_and_activity.sql
  supabase/tests/v1_private_notification_read_implementations.sql
  supabase/tests/v1_notification_peek_request_delivery.sql
  supabase/tests/v1_essential_notifications.sql
  supabase/tests/v1_recommendation_foundation.sql
  supabase/tests/v1_recommendation_projection_queue.sql
  supabase/tests/v1_recommendation_eligibility_geospatial.sql
  supabase/tests/v1_recommendation_publication_boundary.sql
  supabase/tests/v1_recommendation_services.sql
  supabase/tests/v1_recommendation_service_operations.sql
  supabase/tests/v1_recommendation_scale.sql
  supabase/tests/v1_contextual_ecosystem_intelligence.sql
  supabase/tests/v1_private_personalization_preference_implementations.sql
  supabase/tests/v1_release_control_consistency.sql
  supabase/tests/v1_private_authenticated_rpc_implementations.sql
  supabase/tests/v1_private_new_authenticated_rpc_implementations.sql
  supabase/tests/v1_database_lint_runtime_contract_repairs.sql
  supabase/tests/v1_security_advisor_baseline.sql
  supabase/tests/v1_recommendation_personalization.sql
  supabase/tests/v1_recommendation_analytics.sql
  supabase/tests/v1_recommendation_related_services.sql
  supabase/tests/v1_curated_business_marketplace.sql
)

cleanup() {
  "${SUPABASE[@]}" stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${SUPABASE[@]}" start
"${SUPABASE[@]}" db lint --local --level error

for test_file in "${TEST_FILES[@]}"; do
  if [[ ! -f "$test_file" ]]; then
    echo "Missing database certification file: $test_file" >&2
    exit 1
  fi
  echo "Running $test_file"
  "${SUPABASE[@]}" test db "$test_file" --local
done

echo "Migration database certification passed: ${#TEST_FILES[@]} suites completed."
