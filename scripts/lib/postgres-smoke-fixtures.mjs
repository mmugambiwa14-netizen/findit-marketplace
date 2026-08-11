import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import postgres from 'postgres';

export function openSmokeDatabase(smokeTarget) {
  const databaseUrl = process.env.FINDIT_SUPABASE_DB_URL;
  assert.ok(databaseUrl, 'FINDIT_SUPABASE_DB_URL is required for database-backed scale fixtures');
  const parsed = new URL(databaseUrl);
  if (smokeTarget.label === 'local') {
    assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname), 'local scale fixtures require a local database URL');
  } else {
    assert.equal(process.env.FINDIT_ALLOW_HOSTED_SMOKE, 'staging', 'database-backed hosted fixtures require explicit staging authorization');
  }
  return postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
    ssl: smokeTarget.label === 'local' ? false : 'require',
  });
}

function subjectHashes(subjectIds) {
  return [...new Set(subjectIds)].map((value) => crypto.createHash('sha256').update(String(value)).digest('hex'));
}

export async function clearMessageBudgets(sql, senderIds, scopes = ['message.minute']) {
  const hashes = subjectHashes(senderIds);
  if (!hashes.length) return 0;
  const result = await sql`
    delete from private.abuse_rate_limit_buckets
    where scope in ${sql(scopes)}
      and subject_hash in ${sql(hashes)}
  `;
  return result.count;
}
