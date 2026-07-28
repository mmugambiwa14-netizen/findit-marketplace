import {
  adminClient,
  authorizeWorker,
  correlationId,
  json,
  requireJsonRequest,
} from "../_shared/tour-runtime.ts";

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();

  if (!authorizeWorker(req, "FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET")) {
    return json(req, 401, {
      requestId,
      code: "authentication_required",
      message: "A trusted observability scheduler credential is required.",
    });
  }

  try {
    const admin = adminClient();
    const [
      { data: evaluation, error: evaluationError },
      { data: fanoutEvaluation, error: fanoutEvaluationError },
      { data: pruned, error: pruneError },
      { data: prunedFanoutJobs, error: fanoutPruneError },
    ] = await Promise.all([
      admin.rpc("evaluate_operational_alerts", {}),
      admin.rpc("evaluate_notification_fanout_alerts", {}),
      admin.rpc("prune_operational_metrics", {
        p_before: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      admin.rpc("prune_notification_fanout_jobs", {
        p_before: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ]);
    if (evaluationError) throw new Error(`Operational alert evaluation failed: ${evaluationError.message}`);
    if (fanoutEvaluationError) throw new Error(`Notification fan-out alert evaluation failed: ${fanoutEvaluationError.message}`);
    if (pruneError) throw new Error(`Operational metric retention failed: ${pruneError.message}`);
    if (fanoutPruneError) throw new Error(`Notification fan-out retention failed: ${fanoutPruneError.message}`);

    return json(req, 200, {
      requestId,
      evaluated: true,
      prunedBuckets: Number(pruned ?? 0),
      prunedNotificationFanoutJobs: Number(prunedFanoutJobs ?? 0),
      health: evaluation ?? {},
      notificationFanout: fanoutEvaluation ?? {},
    });
  } catch (error) {
    console.error("Tour observability monitor failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "observability_monitor_unavailable",
      message: "Tour operational health could not be evaluated.",
    });
  }
});
