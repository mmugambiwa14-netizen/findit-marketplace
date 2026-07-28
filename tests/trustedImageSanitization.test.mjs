import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTrustedImage } from '../supabase/functions/_shared/trusted-image.ts';

function pngWithMetadata(cleanPng) {
  const payload = Buffer.from('FindIt\0GPS=-17.8252,31.0335', 'utf8');
  const chunk = Buffer.alloc(12 + payload.length);
  chunk.writeUInt32BE(payload.length, 0);
  chunk.write('tEXt', 4, 4, 'ascii');
  payload.copy(chunk, 8);
  return Buffer.concat([cleanPng.subarray(0, 33), chunk, cleanPng.subarray(33), Buffer.from('trailing')]);
}

function jpegFixture() {
  const clean = Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x00, 0xff, 0xd9,
  ]);
  const exif = Buffer.from([0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  return { clean, tagged: Buffer.concat([clean.subarray(0, 2), exif, clean.subarray(2), Buffer.from('trailing')]) };
}

function webpFixture() {
  const clean = Buffer.alloc(30);
  clean.write('RIFF', 0, 4, 'ascii');
  clean.writeUInt32LE(22, 4);
  clean.write('WEBP', 8, 4, 'ascii');
  clean.write('VP8X', 12, 4, 'ascii');
  clean.writeUInt32LE(10, 16);
  const exif = Buffer.alloc(12);
  exif.write('EXIF', 0, 4, 'ascii');
  exif.writeUInt32LE(4, 4);
  exif.write('GPS!', 8, 4, 'ascii');
  const tagged = Buffer.concat([clean, exif, Buffer.from('trailing')]);
  tagged.writeUInt32LE(34, 4);
  tagged[20] = 0x08;
  return { clean, tagged };
}

test('trusted PNG preparation strips text metadata and trailing payloads', () => {
  const clean = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const prepared = prepareTrustedImage(pngWithMetadata(clean));
  assert.equal(prepared.metadataRemoved, true);
  assert.deepEqual(Buffer.from(prepared.bytes), clean);
  assert.deepEqual(prepared.info, { mimeType: 'image/png', extension: 'png', width: 1, height: 1 });
});

test('trusted JPEG preparation strips EXIF and trailing payloads without changing dimensions', () => {
  const { clean, tagged } = jpegFixture();
  const prepared = prepareTrustedImage(tagged);
  assert.equal(prepared.metadataRemoved, true);
  assert.deepEqual(Buffer.from(prepared.bytes), clean);
  assert.deepEqual(prepared.info, { mimeType: 'image/jpeg', extension: 'jpg', width: 1, height: 1 });
});

test('trusted WebP preparation strips EXIF, clears its flag, and repairs RIFF length', () => {
  const { clean, tagged } = webpFixture();
  const prepared = prepareTrustedImage(tagged);
  assert.equal(prepared.metadataRemoved, true);
  assert.deepEqual(Buffer.from(prepared.bytes), clean);
  assert.deepEqual(prepared.info, { mimeType: 'image/webp', extension: 'webp', width: 1, height: 1 });
});
