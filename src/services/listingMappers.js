const DETAIL_FIELD_BY_KIND = {
  property: 'property_details',
  car: 'car_details',
  machinery: 'machinery_details',
};

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Adapts the normalized Supabase listing row to the stable UI shape currently
 * consumed by FindIt's listing cards. Keeping this translation here lets the
 * UI move one vertical slice at a time without leaking database details.
 */
export function mapPublicListing(row) {
  const detailField = DETAIL_FIELD_BY_KIND[row?.kind];
  if (!detailField) {
    throw new TypeError(`Cannot map listing kind: ${row?.kind ?? 'missing'}`);
  }

  const detail = one(row[detailField]) ?? {};
  const location = one(row.location);
  const locationName = location?.name ?? '';

  return {
    ...row,
    ...detail,
    _type: row.kind,

    // Base44 compatibility names still used by the existing cards/details.
    created_date: row.created_at,
    updated_date: row.updated_at,
    location_id: locationName,
    location_ref_id: location?.id ?? null,
    city: locationName,
    suburb: '',
    coordinates: {
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
    },
    seller_email: row.contact_email ?? '',
    negotiable: row.accepts_offers,
    make: detail.brand,
    equipment_hours: detail.usage_hours,
    property_size: detail.size_sqm,

    // Verification is intentionally excluded from the V1 public listing
    // contract. It cannot be inferred from legacy or user-supplied fields.
    verified: false,
  };
}
