import { createClient } from "npm:@supabase/supabase-js@2.110.7";

function configuredAdminKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const serialized = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (serialized) {
    const values = JSON.parse(serialized) as Record<string, string>;
    const value = values.default ?? Object.values(values)[0];
    if (value) return value;
  }
  throw new Error("Missing SUPABASE_SECRET_KEY");
}

function configuredWorkerSecret(adminKey: string): string {
  return Deno.env.get("FINDIT_LISTING_EXPIRY_WORKER_SECRET") ?? adminKey;
}

function constantTimeEqual(left: string, right: string): boolean {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json(405, { code: "method_not_allowed", message: "POST is required." });
  }

  const correlationId = crypto.randomUUID();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    const adminKey = configuredAdminKey();
    const workerSecret = configuredWorkerSecret(adminKey);
    const suppliedAuthorization = req.headers.get("authorization") ?? "";
    if (!constantTimeEqual(suppliedAuthorization, `Bearer ${workerSecret}`)) {
      return json(401, {
        code: "authentication_required",
        message: "A trusted scheduler credential is required.",
      });
    }

    const adminClient = createClient(supabaseUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await adminClient.rpc("process_listing_expiry_notifications");
    if (error) throw new Error("listing expiry operation failed");

    return json(200, {
      correlationId,
      noticesCreated: Number(data?.notices_created ?? 0),
      listingsExpired: Number(data?.listings_expired ?? 0),
    });
  } catch (error) {
    console.error("listing expiry worker failed", { correlationId, error });
    return json(500, {
      correlationId,
      code: "expiry_worker_unavailable",
      message: "Listing expiry processing is temporarily unavailable.",
    });
  }
});
