import { supabase } from '@/lib/supabaseClient';

const CATEGORY_KEYS = Object.freeze(['property', 'car', 'machinery', 'service']);

function normalizeCategories(categories) {
  return [...new Set((categories || []).filter((category) => CATEGORY_KEYS.includes(category)))];
}

export async function getMyPublishingAccess() {
  const { data, error } = await supabase.rpc('get_my_publishing_access');
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    applicationStatus: row?.application_status || 'not_started',
    applicationId: row?.application_id || null,
    approvedCategories: normalizeCategories(row?.approved_categories),
    pendingCategories: normalizeCategories(row?.pending_categories),
    needsInformation: Boolean(row?.needs_information),
    reviewerMessage: row?.reviewer_message || '',
  };
}

export async function submitBusinessApplication(input) {
  const categories = normalizeCategories(input.requestedCategories);
  if (categories.length === 0) throw new Error('Choose at least one business category.');

  const { data, error } = await supabase.rpc('submit_business_application', {
    p_business_name: input.businessName.trim(),
    p_contact_name: input.contactName.trim(),
    p_business_email: input.businessEmail.trim(),
    p_business_phone: input.businessPhone.trim(),
    p_country_code: input.countryCode.trim().toUpperCase(),
    p_city: input.city.trim(),
    p_description: input.description.trim(),
    p_website_url: input.websiteUrl?.trim() || null,
    p_social_url: input.socialUrl?.trim() || null,
    p_expected_inventory_band: input.expectedInventoryBand,
    p_requested_categories: categories,
  });
  if (error) throw error;
  return data;
}

export async function submitManagedListingRequest(input) {
  if (!CATEGORY_KEYS.includes(input.category)) throw new Error('Choose a supported category.');

  const { data, error } = await supabase.rpc('submit_managed_listing_request', {
    p_category: input.category,
    p_owner_name: input.ownerName.trim(),
    p_contact_email: input.contactEmail.trim(),
    p_contact_phone: input.contactPhone.trim(),
    p_country_code: input.countryCode.trim().toUpperCase(),
    p_city: input.city.trim(),
    p_item_summary: input.itemSummary.trim(),
    p_price_expectation: input.priceExpectation?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export function isCategoryApproved(access, category) {
  return Boolean(access?.approvedCategories?.includes(category));
}
