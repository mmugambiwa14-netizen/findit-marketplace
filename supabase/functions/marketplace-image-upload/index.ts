import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { MAX_BYTES, prepareTrustedImage, sha256Hex } from "../_shared/trusted-image.ts";

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("FINDIT_ALLOWED_ORIGINS") ?? "http://127.0.0.1:5173,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
);
const PURPOSES = new Set(["service_photo", "business_logo", "seller_logo"]);

function configuredKey(name: string, legacyName: string): string {
  const direct = Deno.env.get(name) ?? Deno.env.get(legacyName);
  if (direct) return direct;
  const pluralName = name.endsWith("SECRET_KEY") ? "SUPABASE_SECRET_KEYS" : "SUPABASE_PUBLISHABLE_KEYS";
  const serialized = Deno.env.get(pluralName);
  if (serialized) {
    const values = JSON.parse(serialized) as Record<string, string>;
    const value = values.default ?? Object.values(values)[0];
    if (value) return value;
  }
  throw new Error(`Missing ${name}`);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { code: "method_not_allowed", message: "POST is required." });

  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(req, 403, { code: "origin_not_allowed", message: "This upload origin is not allowed." });
  }
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json(req, 401, { code: "authentication_required", message: "Sign in to upload images." });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    const publishableKey = configuredKey("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
    const secretKey = configuredKey("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json(req, 401, { code: "invalid_session", message: "Your session is no longer valid." });
    }

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BYTES + 256_000) {
      return json(req, 413, { code: "image_too_large", message: "Each image must be 5 MB or smaller." });
    }
    const form = await req.formData();
    const purpose = form.get("purpose");
    const file = form.get("file");
    if (typeof purpose !== "string" || !PURPOSES.has(purpose)) {
      return json(req, 400, { code: "invalid_purpose", message: "Choose a supported image purpose." });
    }
    if (!(file instanceof File) || file.size < 1) {
      return json(req, 400, { code: "image_required", message: "Choose an image to upload." });
    }
    if (file.size > MAX_BYTES) {
      return json(req, 413, { code: "image_too_large", message: "Each image must be 5 MB or smaller." });
    }

    const originalBytes = new Uint8Array(await file.arrayBuffer());
    const prepared = prepareTrustedImage(originalBytes);
    const { bytes, info, metadataRemoved } = prepared;
    if (file.type && file.type !== info.mimeType) {
      return json(req, 415, { code: "mime_mismatch", message: "The image contents do not match its file type." });
    }
    const checksum = await sha256Hex(bytes);
    const storagePath = `${userData.user.id}/${purpose}/staging/${crypto.randomUUID()}.${info.extension}`;
    const { data: intentId, error: intentError } = await adminClient.rpc("authorize_marketplace_image_upload", {
      p_user_id: userData.user.id,
      p_purpose: purpose,
      p_storage_path: storagePath,
      p_mime_type: info.mimeType,
      p_byte_size: bytes.length,
      p_width_px: info.width,
      p_height_px: info.height,
      p_sha256_hex: checksum,
    });
    if (intentError || !intentId) {
      return json(req, intentError?.message?.includes("rate exceeded") ? 429 : 403, {
        code: "upload_not_authorized",
        message: intentError?.message?.includes("rate exceeded")
          ? "Too many image uploads. Try again later."
          : "This image upload could not be authorized.",
      });
    }

    const rejectIntent = () => adminClient
      .from("marketplace_image_upload_intents")
      .update({ state: "rejected" })
      .eq("id", intentId);
    const { error: uploadError } = await userClient.storage.from("marketplace-images").upload(storagePath, bytes, {
      contentType: info.mimeType,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      await rejectIntent();
      return json(req, 502, { code: "storage_upload_failed", message: "The image could not be stored. Try again." });
    }

    const { error: completeError } = await adminClient.rpc("complete_marketplace_image_upload", { p_intent_id: intentId });
    if (completeError) {
      await userClient.storage.from("marketplace-images").remove([storagePath]);
      await rejectIntent();
      return json(req, 502, { code: "upload_confirmation_failed", message: "The image could not be confirmed. Try again." });
    }
    const { data: signed, error: signedError } = await userClient.storage
      .from("marketplace-images")
      .createSignedUrl(storagePath, 3600);
    if (signedError || !signed?.signedUrl) {
      await userClient.storage.from("marketplace-images").remove([storagePath]);
      await rejectIntent();
      return json(req, 502, { code: "preview_failed", message: "The image uploaded, but its preview could not be prepared." });
    }

    return json(req, 201, {
      intentId,
      purpose,
      path: storagePath,
      previewUrl: signed.signedUrl,
      mimeType: info.mimeType,
      byteSize: bytes.length,
      metadataRemoved,
      width: info.width,
      height: info.height,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return json(req, 415, { code: "unsupported_image", message: error.message });
    }
    console.error("marketplace-image-upload failed", error);
    return json(req, 500, { code: "upload_unavailable", message: "Image upload is temporarily unavailable." });
  }
});
