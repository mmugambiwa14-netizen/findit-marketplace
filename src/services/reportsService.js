import {
  findReportByReporterAndListing,
  insertListingReport,
} from '@/repositories/reportsRepository';

const REPORT_REASONS = new Set(['fake', 'scam', 'duplicate', 'inappropriate', 'wrong_price', 'other']);
const LISTING_TYPES = {
  property: 'property',
  car: 'vehicle',
  machinery: 'machinery',
};

function requireId(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
}

export function getExistingListingReport(reporterId, listingId) {
  return findReportByReporterAndListing(
    requireId(reporterId, 'Reporter id'),
    requireId(listingId, 'Listing id'),
  );
}

export function submitListingReport({ listing, listingType, reason, description, reporterId }) {
  const normalizedListingType = LISTING_TYPES[listingType];
  if (!normalizedListingType) throw new TypeError('Unsupported listing type');
  if (!REPORT_REASONS.has(reason)) throw new TypeError('Unsupported report reason');

  return insertListingReport({
    listing_id: requireId(listing?.id, 'Listing id'),
    listing_type: normalizedListingType,
    listing_title: typeof listing?.title === 'string' ? listing.title.slice(0, 300) : null,
    reason,
    description: typeof description === 'string' ? description.trim().slice(0, 2000) : '',
    reporter_id: requireId(reporterId, 'Reporter id'),
    status: 'pending',
  });
}
