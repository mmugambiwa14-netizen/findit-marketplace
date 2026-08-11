import crypto from 'node:crypto';

function dataOrThrow(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Establishes disposable approved publishing state for a smoke-test user.
 * The fixture setup uses the trusted server client, while marketplace writes
 * still execute through the user's authenticated client and real RLS/triggers.
 */
export async function grantCuratedPublishing(root, userId, categories, label = 'Smoke publisher') {
  const uniqueCategories = [...new Set(categories)];
  const existing = dataOrThrow(
    await root
      .from('business_applications')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['submitted', 'reviewing', 'needs_information', 'approved'])
      .order('submitted_at', { ascending: false })
      .limit(1),
    `read ${label} publishing application`,
  );

  let applicationId = existing[0]?.id;
  if (applicationId) {
    dataOrThrow(
      await root
        .from('business_applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', applicationId),
      `approve ${label} publishing application`,
    );
  } else {
    const application = dataOrThrow(
      await root
        .from('business_applications')
        .insert({
          id: crypto.randomUUID(),
          user_id: userId,
          business_name: `${label} ${crypto.randomBytes(3).toString('hex')}`,
          contact_name: label,
          business_email: `${userId}@example.test`,
          business_phone: '+263700000000',
          country_code: 'ZW',
          city: 'Harare',
          description: 'Disposable approved publisher created only for automated local or staging smoke certification.',
          expected_inventory_band: '1-10',
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .select('id')
        .single(),
      `create ${label} publishing application`,
    );
    applicationId = application.id;
  }

  if (uniqueCategories.length) {
    dataOrThrow(
      await root.from('business_category_approvals').upsert(
        uniqueCategories.map((category) => ({
          business_application_id: applicationId,
          user_id: userId,
          category,
          status: 'approved',
          approved_at: new Date().toISOString(),
        })),
        { onConflict: 'user_id,category' },
      ),
      `grant ${label} publishing categories`,
    );
  }

  return applicationId;
}
