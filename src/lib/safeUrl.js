/**
 * Scheme allowlist for user-supplied links.
 *
 * Business profile `website` and `social_links` values are validated on write
 * by src/services/businessProfileContracts.js -- but that runs in the browser,
 * so it is UX only. Anyone can write directly to PostgREST with their own key
 * and store `javascript:` or `data:` in those columns. React 18 warns about a
 * `javascript:` href but still renders it, so the link stays clickable.
 *
 * This is the render-time boundary: nothing reaches an href unless it parses
 * as an absolute http(s) URL. Applies to values already in the database as
 * well as anything a future write path lets through.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * @param {unknown} value
 * @returns {string | null} the URL when it is safe to render, otherwise null
 */
export function safeExternalUrl(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate) return null;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  // Protocol comparison is done on the parsed URL rather than the raw string,
  // so `java\tscript:`, leading control characters and mixed case cannot slip
  // past a naive startsWith check.
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  return parsed.toString();
}
