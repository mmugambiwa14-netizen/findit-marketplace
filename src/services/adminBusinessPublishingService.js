import { supabase } from '@/lib/supabaseClient';
import {
  normalizeAdminBusinessApplicationReview,
  normalizeAdminBusinessApplicationsRequest,
  normalizeAdminBusinessCategoryReview,
  normalizeAdminManagedListingRequestsRequest,
  normalizeAdminManagedListingUpdate,
} from '@/services/adminBusinessContracts';

function rpcFailure(message, error) {
  const result = new Error(error?.message || message);
  result.cause = error;
  return result;
}

function pageRows(data, limit, cursorField) {
  const rows = Array.isArray(data) ? data : [];
  const items = rows.slice(0, limit);
  return {
    items,
    nextCursor: rows.length > limit ? items.at(-1)?.[cursorField] || null : null,
  };
}

export async function listBusinessApplications({ status = null, limit = 50, before = null } = {}) {
  const request = normalizeAdminBusinessApplicationsRequest({ status, limit, before });
  const { data, error } = await supabase.rpc('admin_list_business_applications', {
    p_status: request.status,
    p_limit: Math.min(request.limit + 1, 100),
    p_before: request.before,
  });
  if (error) throw rpcFailure('Unable to load business applications', error);
  return pageRows(data, request.limit, 'submitted_at');
}

export async function reviewBusinessApplication(applicationId, action, message = '') {
  const request = normalizeAdminBusinessApplicationReview({ applicationId, action, reviewerMessage: message });
  const { error } = await supabase.rpc('admin_review_business_application', {
    p_application_id: request.applicationId,
    p_action: request.action,
    p_message: request.reviewerMessage || null,
  });
  if (error) throw rpcFailure('Unable to update the business application', error);
}

export async function reviewBusinessCategory(categoryApprovalId, action, message = '') {
  const request = normalizeAdminBusinessCategoryReview({ categoryApprovalId, action, reviewerMessage: message });
  const { error } = await supabase.rpc('admin_review_business_category', {
    p_category_approval_id: request.categoryApprovalId,
    p_action: request.action,
    p_message: request.reviewerMessage || null,
  });
  if (error) throw rpcFailure('Unable to update the category approval', error);
}

export async function listManagedListingRequests({ status = null, limit = 50, before = null } = {}) {
  const request = normalizeAdminManagedListingRequestsRequest({ status, limit, before });
  const { data, error } = await supabase.rpc('admin_list_managed_listing_requests', {
    p_status: request.status,
    p_limit: Math.min(request.limit + 1, 100),
    p_before: request.before,
  });
  if (error) throw rpcFailure('Unable to load managed listing requests', error);
  return pageRows(data, request.limit, 'created_at');
}

export async function updateManagedListingRequest(requestId, status, message = '', assignedTo = null) {
  const request = normalizeAdminManagedListingUpdate({ requestId, status, reviewerMessage: message, assignedTo });
  const { error } = await supabase.rpc('admin_update_managed_listing_request', {
    p_request_id: request.requestId,
    p_status: request.status,
    p_message: request.reviewerMessage || null,
    p_assigned_to: request.assignedTo,
  });
  if (error) throw rpcFailure('Unable to update the managed listing request', error);
}
