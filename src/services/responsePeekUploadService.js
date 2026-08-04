import {
  invokeTourUploadComplete,
  invokeTourUploadIntent,
  uploadTourSourceObject,
} from '@/repositories/listingToursRepository';
import {
  normalizeTourId,
  normalizeTourIntentId,
  normalizeTourUploadIntent,
} from '@/services/listingTourContracts';

function progress(callback, stage, percent, message, details = {}) {
  callback?.({ stage, percent, message, ...details });
}

function expired(resume) {
  const expiresAt = Date.parse(String(resume?.expiresAt || ''));
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 5000;
}

function resumableFailure(error, intent, request) {
  const failure = error instanceof Error ? error : new Error('The Response Peek upload was interrupted');
  failure.resumeUpload = {
    intentId: intent.intentId,
    tourId: intent.tourId,
    path: intent.path,
    uploadToken: intent.uploadToken,
    expiresAt: intent.expiresAt,
    idempotencyKey: request.idempotencyKey,
    peekKind: 'response',
  };
  return failure;
}

async function complete(intentId, callback) {
  progress(callback, 'confirming', 88, 'Confirming the uploaded Response Peek');
  const result = await invokeTourUploadComplete(normalizeTourIntentId(intentId));
  progress(callback, 'queued', 100, 'Response Peek queued for processing', { tourId: result.tourId });
  return result;
}

export async function uploadResponsePeek(input, options = {}) {
  const normalized = normalizeTourUploadIntent(input);
  let request = { ...normalized, peekKind: 'response' };
  let resume = options.resumeUpload || null;
  let renewedIntent = null;
  const callback = options.onProgress;

  if (resume && expired(resume)) {
    progress(callback, 'recovering', 3, 'Checking the interrupted Response Peek upload');
    try {
      return await complete(resume.intentId, callback);
    } catch {
      request = {
        ...request,
        idempotencyKey: resume.idempotencyKey || request.idempotencyKey,
      };
      progress(callback, 'renewing', 6, 'Renewing the upload authorization');
      renewedIntent = await invokeTourUploadIntent(request);
      resume = null;
    }
  }

  progress(callback, 'preparing', 8, resume ? 'Resuming the Response Peek upload' : 'Preparing the Response Peek upload');
  const intent = renewedIntent || (resume
    ? {
        intentId: normalizeTourIntentId(resume.intentId),
        tourId: resume.tourId ? normalizeTourId(resume.tourId) : null,
        path: String(resume.path || ''),
        uploadToken: String(resume.uploadToken || ''),
        expiresAt: resume.expiresAt || null,
      }
    : await invokeTourUploadIntent(request));

  if (!intent.path || !intent.uploadToken) throw new Error('The Response Peek upload authorization is incomplete');

  progress(callback, 'uploading', 24, 'Uploading directly to private storage', {
    intentId: intent.intentId,
    expiresAt: intent.expiresAt,
  });

  try {
    await uploadTourSourceObject({
      path: intent.path,
      uploadToken: intent.uploadToken,
      file: request.file,
    });
  } catch (uploadError) {
    try {
      return await complete(intent.intentId, callback);
    } catch {
      throw resumableFailure(uploadError, intent, request);
    }
  }

  progress(callback, 'uploaded', 78, 'Response Peek uploaded');
  try {
    return await complete(intent.intentId, callback);
  } catch (error) {
    throw resumableFailure(error, intent, request);
  }
}
