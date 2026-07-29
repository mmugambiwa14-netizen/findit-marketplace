export const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 8000;
const MAX_PIXELS = 40_000_000;

export type ImageInfo = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
};

export type PreparedImage = {
  bytes: Uint8Array;
  info: ImageInfo;
  metadataRemoved: boolean;
};

function readU32Big(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function readU16Big(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) + bytes[offset + 1];
}

function readU32Little(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] + (bytes[offset + 1] << 8) +
    (bytes[offset + 2] << 16) + ((bytes[offset + 3] << 24) >>> 0)) >>> 0;
}

function writeU32Little(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function concatenate(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function pngInfo(bytes: Uint8Array): ImageInfo | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  if (ascii(bytes, 12, 4) !== "IHDR") return null;
  return { mimeType: "image/png", extension: "png", width: readU32Big(bytes, 16), height: readU32Big(bytes, 20) };
}

function jpegInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = readU16Big(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (sofMarkers.has(marker) && segmentLength >= 7) {
      return {
        mimeType: "image/jpeg",
        extension: "jpg",
        height: readU16Big(bytes, offset + 3),
        width: readU16Big(bytes, offset + 5),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function webpInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { mimeType: "image/webp", extension: "webp", width, height };
  }
  if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return { mimeType: "image/webp", extension: "webp", width, height };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
    const height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
    return { mimeType: "image/webp", extension: "webp", width, height };
  }
  return null;
}

export function inspectImage(bytes: Uint8Array): ImageInfo {
  const info = pngInfo(bytes) ?? jpegInfo(bytes) ?? webpInfo(bytes);
  if (!info || info.width < 1 || info.height < 1 || info.width > MAX_DIMENSION ||
    info.height > MAX_DIMENSION || info.width * info.height > MAX_PIXELS) {
    throw new TypeError("The file is not a supported image or its dimensions are too large.");
  }
  return info;
}

function sanitizePng(bytes: Uint8Array): { bytes: Uint8Array; removed: boolean } {
  const metadataChunks = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
  const chunks = [bytes.subarray(0, 8)];
  let offset = 8;
  let removed = false;

  while (offset + 12 <= bytes.length) {
    const length = readU32Big(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new TypeError("The PNG structure is incomplete.");
    const type = ascii(bytes, offset + 4, 4);
    if (metadataChunks.has(type)) removed = true;
    else chunks.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") {
      if (offset !== bytes.length) removed = true;
      return removed ? { bytes: concatenate(chunks), removed } : { bytes, removed };
    }
  }
  throw new TypeError("The PNG image has no complete end marker.");
}

function sanitizeJpeg(bytes: Uint8Array): { bytes: Uint8Array; removed: boolean } {
  const chunks = [bytes.subarray(0, 2)];
  let offset = 2;
  let removed = false;

  while (offset < bytes.length) {
    const markerStart = offset;
    if (bytes[offset] !== 0xff) throw new TypeError("The JPEG marker structure is invalid.");
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];

    if (marker === 0xd9) {
      chunks.push(bytes.subarray(markerStart, offset));
      if (offset !== bytes.length) removed = true;
      return removed ? { bytes: concatenate(chunks), removed } : { bytes, removed };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(bytes.subarray(markerStart, offset));
      continue;
    }
    if (offset + 1 >= bytes.length) throw new TypeError("The JPEG segment is incomplete.");
    const segmentLength = readU16Big(bytes, offset);
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > bytes.length) {
      throw new TypeError("The JPEG segment length is invalid.");
    }

    if (marker === 0xda) {
      let eoi = -1;
      for (let cursor = segmentEnd; cursor + 1 < bytes.length; cursor += 1) {
        if (bytes[cursor] === 0xff && bytes[cursor + 1] === 0xd9) {
          eoi = cursor + 2;
          break;
        }
      }
      if (eoi < 0) throw new TypeError("The JPEG image has no complete end marker.");
      chunks.push(bytes.subarray(markerStart, eoi));
      if (eoi !== bytes.length) removed = true;
      return removed ? { bytes: concatenate(chunks), removed } : { bytes, removed };
    }

    const isMetadata = marker === 0xe1 || marker === 0xed || marker === 0xfe ||
      (marker >= 0xe3 && marker <= 0xec) || marker === 0xef;
    if (isMetadata) removed = true;
    else chunks.push(bytes.subarray(markerStart, segmentEnd));
    offset = segmentEnd;
  }
  throw new TypeError("The JPEG image has no complete scan.");
}

function sanitizeWebp(bytes: Uint8Array): { bytes: Uint8Array; removed: boolean } {
  const declaredEnd = readU32Little(bytes, 4) + 8;
  if (declaredEnd < 12 || declaredEnd > bytes.length) {
    throw new TypeError("The WebP container length is invalid.");
  }
  const descriptors: Array<{ type: string; start: number; end: number }> = [];
  let offset = 12;
  let removed = declaredEnd !== bytes.length;
  while (offset + 8 <= declaredEnd) {
    const type = ascii(bytes, offset, 4);
    const length = readU32Little(bytes, offset + 4);
    const end = offset + 8 + length + (length % 2);
    if (end > declaredEnd) throw new TypeError("The WebP chunk length is invalid.");
    descriptors.push({ type, start: offset, end });
    if (type === "EXIF" || type === "XMP ") removed = true;
    offset = end;
  }
  if (offset !== declaredEnd) throw new TypeError("The WebP container is incomplete.");
  if (!removed) return { bytes, removed };

  const chunks: Uint8Array[] = [bytes.subarray(0, 12)];
  for (const descriptor of descriptors) {
    if (descriptor.type === "EXIF" || descriptor.type === "XMP ") continue;
    if (descriptor.type === "VP8X") {
      const chunk = bytes.slice(descriptor.start, descriptor.end);
      if (chunk.length >= 9) chunk[8] &= 0xf3; // clear EXIF and XMP feature flags
      chunks.push(chunk);
    } else {
      chunks.push(bytes.subarray(descriptor.start, descriptor.end));
    }
  }
  const result = concatenate(chunks);
  writeU32Little(result, 4, result.length - 8);
  return { bytes: result, removed };
}

export function prepareTrustedImage(bytes: Uint8Array): PreparedImage {
  const info = inspectImage(bytes);
  const sanitized = info.mimeType === "image/png"
    ? sanitizePng(bytes)
    : info.mimeType === "image/jpeg"
    ? sanitizeJpeg(bytes)
    : sanitizeWebp(bytes);
  const verified = inspectImage(sanitized.bytes);
  if (verified.mimeType !== info.mimeType || verified.width !== info.width || verified.height !== info.height) {
    throw new TypeError("Image sanitization changed the image contract.");
  }
  return { bytes: sanitized.bytes, info: verified, metadataRemoved: sanitized.removed };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
}
