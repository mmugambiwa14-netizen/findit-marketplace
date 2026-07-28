import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const listingUploadUrl = new URL('../supabase/functions/listing-image-upload/index.ts', import.meta.url);
const marketplaceUploadUrl = new URL('../supabase/functions/marketplace-image-upload/index.ts', import.meta.url);
const trustedImageUrl = new URL('../supabase/functions/_shared/trusted-image.ts', import.meta.url);

const [listingUpload, marketplaceUpload, trustedImage] = await Promise.all([
  readFile(listingUploadUrl, 'utf8'),
  readFile(marketplaceUploadUrl, 'utf8'),
  readFile(trustedImageUrl, 'utf8'),
]);

test('upload responses do not cache signed previews or permit MIME sniffing', () => {
  for (const source of [listingUpload, marketplaceUpload]) {
    assert.match(source, /"Cache-Control": "no-store"/);
    assert.match(source, /"X-Content-Type-Options": "nosniff"/);
    assert.match(source, /createSignedUrl\(storagePath, 3600\)/);
  }
});

test('storage keys are server-generated and owner scoped', () => {
  assert.match(
    listingUpload,
    /`\$\{userData\.user\.id\}\/staging\/\$\{crypto\.randomUUID\(\)\}\.\$\{info\.extension\}`/,
  );
  assert.match(
    marketplaceUpload,
    /`\$\{userData\.user\.id\}\/\$\{purpose\}\/staging\/\$\{crypto\.randomUUID\(\)\}\.\$\{info\.extension\}`/,
  );
  assert.doesNotMatch(listingUpload, /file\.name/);
  assert.doesNotMatch(marketplaceUpload, /file\.name/);
});

test('trusted image preparation keeps bounded byte and pixel limits', () => {
  assert.match(trustedImage, /MAX_BYTES = 5 \* 1024 \* 1024/);
  assert.match(trustedImage, /MAX_DIMENSION = 8000/);
  assert.match(trustedImage, /MAX_PIXELS = 40_000_000/);
  assert.match(trustedImage, /prepareTrustedImage/);
  assert.match(trustedImage, /sha256Hex/);
});
