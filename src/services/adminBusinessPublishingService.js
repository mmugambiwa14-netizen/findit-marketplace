import { supabase } from '@/lib/supabaseClient';
import {
  normalizeBusinessAccountRow,
  normalizeBusinessAccountSearch,
  normalizeBusinessListingPublication,
  normalizeBusinessOnboarding,
} from '@/services/adminBusinessOnboardingContracts';
import { normalizeListingSubmission } from '@/services/listingSubmissionContracts';

function rpcFailure(message, error) {
  const result = new Error(error?.message || message);
  result.cause = error;
  return result;
}

export async function listBusinessApplications({ status = null, limit = 50, before = null } = {}) {
  const { data, error } = await supabase.rpc('admin_list_business_applications', {
    p_status: status,
    p_limit: limit,
    p_before: before,
  });
  if (error) throw rpcFailure('Unable to load business applications', error);
  return Array.isArray(data) ? data : [];
}

export async function reviewBusinessApplication(applicationId, action, message = '') {
  const { error } = await supabase.rpc('admin_review_business_application', {
    p_application_id: applicationId,
    p_action: action,
    p_message: message || null,
  });
  if (error) throw rpcFailure('Unable to update the business application', error);
}

export async function reviewBusinessCategory(categoryApprovalId, action, message = '') {
  const { error } = await supabase.rpc('admin_review_business_category', {
    p_category_approval_id: categoryApprovalId,
    p_action: action,
    p_message: message || null,
  });
  if (error) throw rpcFailure('Unable to update the category approval', error);
}

export async function listManagedListingRequests({ status = null, limit = 50, before = null } = {}) {
  const { data, error } = await supabase.rpc('admin_list_managed_listing_requests', {
    p_status: status,
    p_limit: limit,
    p_before: before,
  });
  if (error) throw rpcFailure('Unable to load managed listing requests', error);
  return Array.isArray(data) ? data : [];
}

export async function updateManagedListingRequest(requestId, status, message = '', assignedTo = null) {
  const { error } = await supabase.rpc('admin_update_managed_listing_request', {
    p_request_id: requestId,
    p_status: status,
    p_message: message || null,
    p_assigned_to: assignedTo,
  });
  if (error) throw rpcFailure('Unable to update the managed listing request', error);
}

export async function searchBusinessAccounts(query, limit = 10) {
  const request = normalizeBusinessAccountSearch(query, limit);
  const { data, error } = await supabase.rpc('admin_search_business_accounts', {
    p_query: request.query,
    p_limit: request.limit,
  });
  if (error) throw rpcFailure('Unable to search accounts', error);
  return (Array.isArray(data) ? data : []).map(normalizeBusinessAccountRow);
}

export async function onboardBusiness(input) {
  const request = normalizeBusinessOnboarding(input);
  const details = request.businessDetails;

  const { data, error } = await supabase.rpc('admin_onboard_business', {
    p_user_id: request.userId,
    p_business_name: details?.businessName ?? '',
    p_contact_name: details?.contactName ?? '',
    p_business_email: details?.businessEmail ?? '',
    p_business_phone: details?.businessPhone ?? '',
    p_country_code: details?.countryCode ?? '',
    p_city: details?.city ?? '',
    p_description: details?.description ?? '',
    p_categories: request.categories,
    p_expected_inventory_band: details?.expectedInventoryBand ?? '1-10',
    p_website_url: details?.websiteUrl ?? null,
    p_social_url: details?.socialUrl ?? null,
    p_note: request.note,
  });
  if (error) throw rpcFailure('Unable to onboard this business', error);
  return {
    applicationId: data?.application_id || null,
    userId: data?.user_id || null,
    categories: Array.isArray(data?.categories) ? data.categories : [],
    reusedExistingApplication: Boolean(data?.reused_existing_application),
  };
}

/**
 * Publishes a listing owned by a business.
 *
 * Two identities are in play and they are not interchangeable. The uploading
 * admin owns the storage paths, which is the identity the listing submission
 * contract validates the media against; the business owns the published
 * listing.
 */
export async function createBusinessListing(input) {
  const publication = normalizeBusinessListingPublication(input);
  const submission = normalizeListingSubmission(publication.uploaderUserId, input);

  const { data, error } = await supabase.rpc('admin_create_business_listing', {
    p_owner_user_id: publication.ownerUserId,
    p_submission_key: submission.submissionKey,
    p_listing: submission.listing,
    p_detail: submission.detail,
    p_attributes: submission.attributes,
    p_media: submission.media,
    p_reason: publication.reason,
    p_managed_request_id: publication.managedRequestId,
  });
  if (error) throw rpcFailure('Unable to publish this listing', error);
  return data;
}
