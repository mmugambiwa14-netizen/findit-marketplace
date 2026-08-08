import { hydrateMarketplaceCardImages } from '@/services/marketplaceImagesService';
import { attachPublicTourSummaries } from '@/services/listingToursService';

function mapServiceCard(row) {
  return {
    ...row,
    price: row.price == null ? null : Number(row.price),
    subcategories: Array.isArray(row.subcategories) ? row.subcategories : [],
  };
}

/**
 * Creates card-ready service rows with one page-level cover-image signing batch.
 * When Peek summaries are requested, media signing and Peek metadata load in
 * parallel because neither remote read depends on the other.
 */
export async function enrichPublicServiceCards(rows, { includeTours = true } = {}) {
  const source = Array.isArray(rows) ? rows : [];
  if (source.length === 0) return [];

  const base = source.map(mapServiceCard);
  if (!includeTours) {
    return (await hydrateMarketplaceCardImages(source, 'service_photo')).map(mapServiceCard);
  }

  const [hydratedRows, tourRows] = await Promise.all([
    hydrateMarketplaceCardImages(source, 'service_photo'),
    attachPublicTourSummaries(base, 'service'),
  ]);
  const tourById = new Map(tourRows.map((service) => [service.id, service.tour ?? null]));

  return hydratedRows.map(mapServiceCard).map((service) => ({
    ...service,
    tour: tourById.get(service.id) ?? null,
  }));
}
