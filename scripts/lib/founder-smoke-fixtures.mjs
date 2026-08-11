import assert from 'node:assert/strict';

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

async function startOneTimeSession(root, browser, founder, label) {
  const generated = success(
    await root.auth.admin.generateLink({ type: 'magiclink', email: founder.email }),
    `generate ${label} one-time founder session`,
  );
  const verified = success(
    await browser.auth.verifyOtp({
      token_hash: generated.properties.hashed_token,
      type: 'magiclink',
    }),
    `start ${label} one-time founder session`,
  );
  assert.ok(verified.session?.access_token, `${label} founder session must include an access token`);
  return verified.session;
}

/**
 * Starts a browser-equivalent session for the singleton founder identity.
 * Existing staging/local founders are preserved. A local-only disposable
 * founder may be created when the ignored FINDIT_TEST_FOUNDER_EMAIL value is
 * supplied; the clear address never belongs in repository source.
 */
export async function signInFounder({ root, browser, smokeTarget, password, label = 'smoke' }) {
  const existing = success(
    await root.from('users').select('id,email').eq('role', 'admin').eq('super_admin', true),
    `locate ${label} founder`,
  );
  assert.ok(existing.length <= 1, `${label} target must never contain multiple founder admins`);

  if (existing.length === 1) {
    if (smokeTarget.label !== 'local') {
      assert.equal(
        process.env.FINDIT_ALLOW_STAGING_FOUNDER_SESSION,
        'staging',
        'FINDIT_ALLOW_STAGING_FOUNDER_SESSION=staging is required for hosted founder coverage',
      );
    }
    const session = await startOneTimeSession(root, browser, existing[0], label);
    return { userId: existing[0].id, email: existing[0].email, session, preserveUser: true };
  }

  assert.equal(smokeTarget.label, 'local', 'hosted staging must already contain its singleton founder');
  const email = process.env.FINDIT_TEST_FOUNDER_EMAIL?.trim().toLowerCase();
  assert.ok(email, 'FINDIT_TEST_FOUNDER_EMAIL is required for a disposable local founder fixture');
  assert.ok(password, 'a password is required for a disposable local founder fixture');

  const userId = success(await root.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${label} founder` },
  }), `create ${label} local founder`).user.id;
  try {
    const profile = success(
      await root.from('users').select('role,super_admin').eq('id', userId).single(),
      `verify ${label} local founder profile`,
    );
    assert.deepEqual(
      profile,
      { role: 'admin', super_admin: true },
      'the founder identity must bootstrap the locked admin role',
    );
    const signedIn = success(
      await browser.auth.signInWithPassword({ email, password }),
      `sign in ${label} local founder`,
    );
    return { userId, email, session: signedIn.session, preserveUser: false };
  } catch (error) {
    const cleanup = await root.auth.admin.deleteUser(userId);
    if (cleanup.error) {
      throw new AggregateError([error, cleanup.error], `Failed to initialize and remove ${label} local founder`);
    }
    throw error;
  }
}

export async function deleteDisposableFounder(root, founder) {
  if (founder?.userId && !founder.preserveUser) {
    success(
      await root.from('audit_logs').delete().eq('admin_user_id', founder.userId),
      'delete disposable local founder audit fixtures',
    );
    success(await root.auth.admin.deleteUser(founder.userId), 'delete disposable local founder');
  }
}
