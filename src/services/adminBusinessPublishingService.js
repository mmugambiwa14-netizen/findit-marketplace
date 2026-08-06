import { supabase } from '@/lib/supabaseClient';

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
