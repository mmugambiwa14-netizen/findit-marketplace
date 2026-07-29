// Shared request-boundary guards for the recommendation and contextual runtimes.
//
// Both runtimes previously trusted the content-length header alone. A chunked
// request omits that header, so the guard passed and the body was then read
// without any bound. These helpers bound what is actually read, and bound the
// calls that would otherwise hold an isolate open past the caller's own timeout.

export const BODY_TOO_LARGE = Symbol("body_too_large");
export const BODY_INVALID = Symbol("body_invalid");

/**
 * Read and parse a JSON body, refusing to buffer more than maximumBytes.
 *
 * The declared content-length is still rejected early when it is present and
 * already over the limit, but the running total is what actually enforces the
 * bound, so a chunked or mis-declared request cannot slip past it.
 */
export async function readBoundedJson(
  request: Request,
  maximumBytes: number,
): Promise<unknown | typeof BODY_TOO_LARGE | typeof BODY_INVALID> {
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maximumBytes) return BODY_TOO_LARGE;

  const body = request.body;
  if (!body) return BODY_INVALID;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return BODY_TOO_LARGE;
      }
      chunks.push(value);
    }
  } catch {
    return BODY_INVALID;
  } finally {
    reader.releaseLock();
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    return BODY_INVALID;
  }
}

/**
 * Resolve to null rather than hanging when a dependency outlives its budget.
 *
 * Used for identity resolution, which happens before the database policy timeout
 * applies and would otherwise be unbounded.
 */
export async function withBoundedTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}
