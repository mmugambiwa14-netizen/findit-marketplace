import {
  adminClient,
  bearerAuthorization,
  correlationId,
  isUuid,
  json,
  requireJsonRequest,
  toursBackendEnabled,
  userClient,
} from "../_shared/tour-runtime.ts";

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();

  if (!toursBackendEnabled()) {
    return json(req, 503, { requestId, code: "tours_disabled", message: "Tour uploads are disabled." });
  }
  const authorization = bearerAuthorization(req);
  if (!authorization) {
    return json(req, 401, { requestId, code: "authentication_required", message: "Sign in to complete a Tour upload." });
  }

  try {
    const payload = await req.json() as { intentId?: unknown };
    if (!isUuid(payload.intentId)) {
      return json(req, 400, { requestId, code: "invalid_intent", message: "A valid upload intent is required." });
    }
    const user = userClient(authorization);
    const { data: userData, error: userError } = await user.auth.getUser();
    if (userError || !userData.user) {
      return json(req, 401, { requestId, code: "invalid_session", message: "Your session is no longer valid." });
    }

    const admin = adminClient();
    const { data: tourId, error } = await admin.rpc("complete_tour_upload", {
      p_user_id: userData.user.id,
      p_intent_id: payload.intentId,
    });
    if (error || !tourId) {
      const message = error?.message ?? "Tour upload could not be confirmed";
      return json(req, message.includes("missing") || message.includes("mismatch") ? 422 : 400, {
        requestId,
        code: "upload_confirmation_failed",
        message: "The uploaded video could not be confirmed. Upload it again.",
      });
    }

    return json(req, 200, {
      requestId,
      tourId,
      status: "uploaded",
      message: "The Tour was uploaded and is queued for processing.",
    });
  } catch (error) {
    console.error("tour upload completion failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "upload_completion_unavailable",
      message: "Tour upload confirmation is temporarily unavailable.",
    });
  }
});
