import { createHash } from 'node:crypto';
import {
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const projectRef = process.env.FINDIT_EXPECTED_PROJECT_REF;
const url = process.env.FINDIT_SUPABASE_URL;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const outputDirectory = process.env.FINDIT_BACKUP_DIRECTORY;

if (
  process.env.FINDIT_ALLOW_HOSTED_BACKUP !== 'staging'
  || !projectRef
  || !url
  || new URL(url).hostname !== `${projectRef}.supabase.co`
  || !secretKey
  || !outputDirectory
) {
  throw new Error(
    'Hosted backup requires the staging opt-in, exact project ref, HTTPS URL, '
    + 'secret key, and an explicit output directory.',
  );
}

const publicTables = [
  'admin_teams',
  'announcements',
  'app_alerts',
  'audit_logs',
  'business_profiles',
  'car_details',
  'categories',
  'conversation_reports',
  'conversations',
  'email_templates',
  'escrow_transactions',
  'faqs',
  'follows',
  'inquiries',
  'legal_bookings',
  'legal_practitioners',
  'legal_specializations',
  'listing_media',
  'listing_upload_intents',
  'listings',
  'locations',
  'machinery_details',
  'marketplace_image_upload_intents',
  'neighbourhoods',
  'payments',
  'practitioner_payouts',
  'practitioner_reviews',
  'property_details',
  'reports',
  'reviews',
  'saved_listings',
  'seller_ratings',
  'service_bookings',
  'service_disputes',
  'service_media',
  'services',
  'subscriptions',
  'support_agents',
  'support_messages',
  'support_requests',
  'support_settings',
  'support_tickets',
  'terms',
  'ticket_activity_log',
  'ticket_attachments',
  'ticket_templates',
  'user_presence',
  'users',
  'verification_requests',
];

const client = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});
const root = resolve(outputDirectory);
mkdirSync(root, { recursive: true });
const manifest = {
  format: 'findit-logical-backup-v1',
  projectRef,
  createdAt: new Date().toISOString(),
  schemaSource: 'Git-tracked supabase/migrations/0001-0029',
  files: [],
  tableRows: {},
};

function writeArtifact(relativePath, value) {
  const path = join(root, relativePath);
  mkdirSync(resolve(path, '..'), { recursive: true });
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  writeFileSync(path, bytes);
  manifest.files.push({
    path: relativePath.replaceAll('\\', '/'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

async function readAllRows(table) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

for (const table of publicTables) {
  const rows = await readAllRows(table);
  manifest.tableRows[table] = rows.length;
  writeArtifact(`public/${table}.json`, rows);
}

const authUsers = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await client.auth.admin.listUsers({
    page,
    perPage: 1000,
  });
  if (error) throw new Error(`auth.users: ${error.message}`);
  authUsers.push(...data.users);
  if (data.users.length < 1000) break;
}
writeArtifact('auth/users.json', authUsers);

const { data: buckets, error: bucketError } = await client.storage.listBuckets();
if (bucketError) throw new Error(`storage buckets: ${bucketError.message}`);
writeArtifact('storage/buckets.json', buckets);

async function exportStorageFolder(bucket, prefix = '') {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`storage ${bucket}/${prefix}: ${error.message}`);

    for (const entry of data) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        await exportStorageFolder(bucket, objectPath);
        continue;
      }
      if (
        objectPath.startsWith('/')
        || objectPath.split('/').some((segment) => segment === '..')
      ) {
        throw new Error(`Unsafe storage object path: ${bucket}/${objectPath}`);
      }

      const { data: blob, error: downloadError } = await client.storage
        .from(bucket)
        .download(objectPath);
      if (downloadError) {
        throw new Error(`download ${bucket}/${objectPath}: ${downloadError.message}`);
      }
      writeArtifact(
        `storage/objects/${bucket}/${objectPath}`,
        Buffer.from(await blob.arrayBuffer()),
      );
    }

    if (data.length < 1000) break;
  }
}

for (const bucket of buckets) {
  await exportStorageFolder(bucket.name);
}

writeArtifact('manifest.json', {
  ...manifest,
  totals: {
    publicTables: publicTables.length,
    publicRows: Object.values(manifest.tableRows)
      .reduce((total, count) => total + count, 0),
    authUsers: authUsers.length,
    storageBuckets: buckets.length,
    storageObjects: manifest.files
      .filter((file) => file.path.startsWith('storage/objects/'))
      .length,
  },
});

console.log(JSON.stringify({
  status: 'complete',
  directory: root,
  artifacts: manifest.files.length + 1,
  authUsers: authUsers.length,
  storageBuckets: buckets.length,
}));
