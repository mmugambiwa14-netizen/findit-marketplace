import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Sign in again to continue." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Account deletion is temporarily unavailable." }, 503);

  let body: { confirmation?: string } = {};
  try { body = await request.json(); } catch { return json({ error: "Type DELETE to confirm." }, 400); }
  if ((body.confirmation || "").trim().toUpperCase() !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Your session has expired. Log in again to continue." }, 401);

  const { data: prepared, error: prepareError } = await userClient.rpc("prepare_own_account_deletion", { p_confirmation: "DELETE" });
  if (prepareError) {
    const message = /administrator/i.test(prepareError.message)
      ? "Administrator accounts must transfer their responsibilities before deletion."
      : "We could not delete your account. Please try again.";
    return json({ error: message }, 400);
  }

  const deletedEmail = `deleted-${user.id.replaceAll("-", "")}@deleted.invalid`;
  const randomPassword = `${crypto.randomUUID()}${crypto.randomUUID()}Aa1!`;
  const { error: identityError } = await adminClient.auth.admin.updateUserById(user.id, {
    email: deletedEmail,
    password: randomPassword,
    email_confirm: true,
    ban_duration: "876000h",
    user_metadata: { deleted: true, deleted_at: new Date().toISOString() },
    app_metadata: { ...(user.app_metadata || {}), account_deleted: true },
  });

  if (identityError) {
    console.error("Account identity anonymisation failed", { userId: user.id, error: identityError.message });
    return json({ error: "Your profile was removed, but sign-in closure needs support. Please contact FindIt support.", deletion_started: true }, 500);
  }

  return json({ deleted: true, completed_at: prepared?.completed_at || new Date().toISOString(), retained_records_anonymised: true });
});
