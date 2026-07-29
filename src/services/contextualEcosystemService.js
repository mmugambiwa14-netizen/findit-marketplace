import { supabase } from '@/lib/supabaseClient';

const VALID_STAGES = new Set(['discover', 'evaluate', 'prepare', 'transact', 'own']);
const REQUEST_TIMEOUT_MS = 1200;

function emptyResult(subjectListingId, reason = 'service_unavailable') {
  return {
    contractVersion: 1,
    subjectListingId: subjectListingId ?? null,
    sections: [],
    degraded: true,
    reason,
  };
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validSection(section) {
  return section
    && typeof section === 'object'
    && typeof section.contextKey === 'string'
    && typeof section.label === 'string'
    && VALID_STAGES.has(section.journeyStage)
    && typeof section.service === 'string'
    && typeof section.reasonCode === 'string'
    && Number.isInteger(section.maximumItems)
    && section.maximumItems >= 1
    && section.maximumItems <= 24;
}

export async function fetchContextualEcosystemPlan({
  subjectListingId,
  journeyStage = null,
  maxSections = 6,
  signal,
} = {}) {
  if (!isUuid(subjectListingId)) return emptyResult(subjectListingId, 'invalid_subject');
  if (journeyStage !== null && !VALID_STAGES.has(journeyStage)) return emptyResult(subjectListingId, 'invalid_journey_stage');
  if (!Number.isInteger(maxSections) || maxSections < 1 || maxSections > 12) return emptyResult(subjectListingId, 'invalid_section_limit');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const { data, error } = await supabase.functions.invoke('contextual-ecosystem', {
      body: { subjectListingId, journeyStage: journeyStage ?? undefined, maxSections },
      signal: controller.signal,
    });

    if (error || !data || typeof data !== 'object' || !Array.isArray(data.sections)) {
      return emptyResult(subjectListingId);
    }
    if (!data.sections.every(validSection)) return emptyResult(subjectListingId, 'invalid_response');

    return {
      contractVersion: Number(data.contractVersion) || 1,
      requestId: typeof data.requestId === 'string' ? data.requestId : null,
      correlationId: typeof data.correlationId === 'string' ? data.correlationId : null,
      subjectListingId,
      categoryKey: typeof data.categoryKey === 'string' ? data.categoryKey : null,
      subcategoryKey: typeof data.subcategoryKey === 'string' ? data.subcategoryKey : null,
      sections: data.sections.slice(0, maxSections),
      degraded: Boolean(data.degraded),
      reason: typeof data.reason === 'string' ? data.reason : null,
    };
  } catch {
    return emptyResult(subjectListingId, controller.signal.aborted ? 'timeout' : 'service_unavailable');
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abort);
  }
}
