import { hmacSha256Hex } from "./tour-runtime.ts";

export type TourProcessingDispatch = {
  tourId: string;
  leaseToken: string;
  attempt: number;
  source: { signedUrl: string; mimeType: string; byteSize: number; declaredDurationSeconds: number };
  playback: { signedUploadUrl: string; path: string; mimeType: "video/mp4"; maxLongEdge: 1280; maxShortEdge: 720 };
  thumbnail: { signedUploadUrl: string; path: string; mimeType: "image/webp" };
  callback: { url: string; expiresAt: string };
};

export async function dispatchTourProcessing(
  payload: TourProcessingDispatch,
): Promise<{ processorName: string; processorJobId: string }> {
  const endpoint = Deno.env.get("TOUR_PROCESSOR_URL");
  const secret = Deno.env.get("TOUR_PROCESSOR_SECRET");
  if (!endpoint || !secret) throw new Error("Tour processor is not configured");

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await hmacSha256Hex(secret, `${timestamp}.${body}`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-findit-timestamp": timestamp,
      "x-findit-signature": signature,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Tour processor rejected dispatch (${response.status})`);
  const result = await response.json() as { jobId?: unknown; processor?: unknown };
  if (typeof result.jobId !== "string" || !result.jobId.trim()) {
    throw new Error("Tour processor did not return a job id");
  }
  const processorName = typeof result.processor === "string" && result.processor.trim()
    ? result.processor.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 80)
    : "configured-processor";
  return { processorName, processorJobId: result.jobId.trim().slice(0, 255) };
}
