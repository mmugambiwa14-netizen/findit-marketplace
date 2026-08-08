import {
  adminClient,
  authorizeWorker,
  correlationId,
  json,
  recordOperationalMetric,
  requireJsonRequest,
} from "../_shared/tour-runtime.ts";

type ClaimedJob = {
  job_id: string;
  claim_token: string;
};

type FanoutResult = {
  processed?: number;
  complete?: boolean;
};

const MAX_RECIPIENTS_PER_INVOCATION = 2_000;

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();

  if (!authorizeWorker(req, "FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET")) {
    return json(req, 401, {
      requestId,
      code: "authentication_required",
      message: "A trusted notification scheduler credential is required.",
    });
  }

  try {
    const payload = await req.json().catch(() => ({})) as {
      jobLimit?: unknown;
      recipientLimit?: unknown;
    };
    const jobLimit = payload.jobLimit === undefined ? 10 : Number(payload.jobLimit);
    const recipientLimit = payload.recipientLimit === undefined ? 200 : Number(payload.recipientLimit);
    if (!Number.isInteger(jobLimit) || jobLimit < 1 || jobLimit > 25) {
      return json(req, 400, { requestId, code: "invalid_job_limit", message: "jobLimit must be from 1 to 25." });
    }
    if (!Number.isInteger(recipientLimit) || recipientLimit < 1 || recipientLimit > 500) {
      return json(req, 400, { requestId, code: "invalid_recipient_limit", message: "recipientLimit must be from 1 to 500." });
    }

    const claimLimit = Math.min(
      jobLimit,
      Math.max(1, Math.floor(MAX_RECIPIENTS_PER_INVOCATION / recipientLimit)),
    );

    const admin = adminClient();
    const { data, error: claimError } = await admin.rpc("claim_notification_fanout_jobs", {
      p_limit: claimLimit,
      p_lease_seconds: 120,
    });
    if (claimError) throw new Error(`Notification fan-out claim failed: ${claimError.message}`);

    const jobs = (data ?? []) as ClaimedJob[];
    let recipientsProcessed = 0;
    let completedJobs = 0;
    let requeuedJobs = 0;
    let failedJobs = 0;

    for (const job of jobs) {
      try {
        const { data: result, error } = await admin.rpc("process_notification_fanout_job", {
          p_job_id: job.job_id,
          p_claim_token: job.claim_token,
          p_recipient_limit: recipientLimit,
        });
        if (error) throw new Error(error.message);
        const normalized = (result ?? {}) as FanoutResult;
        const processed = Number(normalized.processed ?? 0);
        recipientsProcessed += Number.isFinite(processed) ? processed : 0;
        if (normalized.complete === true) completedJobs += 1;
        else requeuedJobs += 1;
      } catch (error) {
        failedJobs += 1;
        const code = error instanceof Error ? error.message.slice(0, 120) : "fanout_failed";
        const { error: failError } = await admin.rpc("fail_notification_fanout_job", {
          p_job_id: job.job_id,
          p_claim_token: job.claim_token,
          p_error_code: code,
        });
        if (failError) console.error("Notification fan-out failure could not be recorded", { requestId, jobId: job.job_id, error: failError.message });
      }
    }

    await Promise.all([
      recipientsProcessed > 0
        ? recordOperationalMetric(admin, {
          name: "notification_fanout_recipients",
          value: 1,
          sampleCount: recipientsProcessed,
        })
        : Promise.resolve(),
      failedJobs > 0
        ? recordOperationalMetric(admin, {
          name: "notification_fanout_attempt_failed",
          value: 1,
          sampleCount: failedJobs,
        })
        : Promise.resolve(),
    ]);

    return json(req, failedJobs > 0 ? 207 : 200, {
      requestId,
      claimedJobs: jobs.length,
      completedJobs,
      requeuedJobs,
      failedJobs,
      recipientsProcessed,
    });
  } catch (error) {
    console.error("Essential notification fan-out failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "notification_fanout_unavailable",
      message: "Essential notification fan-out is temporarily unavailable.",
    });
  }
});
