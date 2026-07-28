import { supabase } from '@/lib/supabaseClient';

export async function findReportByReporterAndListing(reporterId, listingId) {
  const { data, error } = await supabase
    .from('reports')
    .select('id, listing_id, reporter_id, status, created_at')
    .eq('reporter_id', reporterId)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const repositoryError = new Error('Unable to read listing report state');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? null;
}

export async function insertListingReport(report) {
  const { data, error } = await supabase
    .from('reports')
    .insert(report)
    .select('id, listing_id, reporter_id, status, created_at')
    .single();

  if (error) {
    const repositoryError = new Error('Unable to submit listing report');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data;
}
