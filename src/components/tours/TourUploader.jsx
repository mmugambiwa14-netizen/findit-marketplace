import { useRef, useState } from 'react';
import { Camera, ChevronRight, Film, RotateCcw, Trash2, Upload } from 'lucide-react';
import CameraPermissionDialog from '@/components/permissions/CameraPermissionDialog';
import { Button } from '@/components/ui/button';
import {
  PERMISSION_KINDS,
  hasSeenPermissionIntro,
  markPermissionIntroSeen,
  readBrowserPermissionState,
} from '@/lib/contextualPermissions';
import { featureFlags } from '@/lib/featureFlags';
import { userFacingError } from '@/lib/userFacingErrors';
import {
  TOUR_ALLOWED_MIME_TYPES,
  TOUR_MAX_DURATION_SECONDS,
  TOUR_MAX_SOURCE_BYTES,
  normalizeTourVideoFile,
} from '@/services/listingTourContracts';
import { uploadListingTour } from '@/services/listingToursService';
import { uploadResponsePeek } from '@/services/responsePeekUploadService';
import TourRecordingGuide from './TourRecordingGuide';
import TourUploadProgress from './TourUploadProgress';

function durationLabel(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function sizeLabel(bytes) {
  return `${(Number(bytes || 0) / (1024 * 1024)).toFixed(1)} MB`;
}

function inspectVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Choose another video.'));
    }, 15000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error('Choose another video.'));
        return;
      }
      resolve({ durationSeconds: duration, previewUrl: url });
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error('This video cannot be opened. Choose another one.'));
    };
    video.src = url;
  });
}

export default function TourUploader({
  parentType = 'listing',
  parentId = null,
  peekKind = 'main',
  category,
  value,
  onChange,
  onUploaded = null,
  onUploadFailed = null,
  disabled = false,
  heading = null,
  onBusyChange = null,
  onSkip = null,
}) {
  const uploadInputRef = useRef(null);
  const recordInputRef = useRef(null);
  const [selecting, setSelecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [cameraExplanationOpen, setCameraExplanationOpen] = useState(false);
  const draft = value || null;
  const isResponse = peekKind === 'response';
  const parentLabel = parentType === 'service' ? 'service' : 'listing';
  const managementLabel = parentType === 'service' ? 'Manage services' : 'Manage listings';
  const resolvedHeading = heading || (isResponse ? 'Response Peek' : 'Peek video');

  if (!featureFlags.tours) return null;

  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSelecting(true);
    onBusyChange?.(true);
    setError('');
    try {
      if (!TOUR_ALLOWED_MIME_TYPES.includes(file.type)) throw new TypeError('Choose an MP4, MOV, or WebM video.');
      if (file.size < 1 || file.size > TOUR_MAX_SOURCE_BYTES) throw new RangeError('Choose a video under 250 MB.');
      const inspected = await inspectVideo(file);
      if (inspected.durationSeconds > TOUR_MAX_DURATION_SECONDS) {
        URL.revokeObjectURL(inspected.previewUrl);
        throw new RangeError('Choose a video that is 2 minutes or shorter.');
      }
      normalizeTourVideoFile(file, inspected.durationSeconds);
      if (draft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.previewUrl);
      onChange?.({
        file,
        durationSeconds: inspected.durationSeconds,
        previewUrl: inspected.previewUrl,
        idempotencyKey: crypto.randomUUID(),
        peekKind: isResponse ? 'response' : 'main',
        status: 'selected',
        resumeUpload: null,
        error: '',
      });
    } catch (failure) {
      setError(userFacingError(failure, 'We could not use this video. Choose another one.'));
    } finally {
      setSelecting(false);
      onBusyChange?.(false);
    }
  };

  const openCamera = async () => {
    setError('');
    const permissionState = await readBrowserPermissionState(PERMISSION_KINDS.CAMERA);
    if (permissionState === 'denied') {
      setError('Camera access is blocked for PeekaListing. Allow camera access in your browser or device settings, then try again. You can still upload an existing video.');
      return;
    }
    if (permissionState === 'granted' || hasSeenPermissionIntro(PERMISSION_KINDS.CAMERA)) {
      recordInputRef.current?.click();
      return;
    }
    setCameraExplanationOpen(true);
  };

  const continueToCamera = () => {
    markPermissionIntroSeen(PERMISSION_KINDS.CAMERA);
    setCameraExplanationOpen(false);
    window.requestAnimationFrame(() => recordInputRef.current?.click());
  };

  const clear = () => {
    if (draft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.previewUrl);
    setError('');
    setProgress(null);
    onChange?.(null);
  };

  const upload = async () => {
    if (!parentId || !draft?.file) return;
    setUploading(true);
    onBusyChange?.(true);
    setError('');
    try {
      const uploadFunction = isResponse ? uploadResponsePeek : uploadListingTour;
      const result = await uploadFunction({
        parentType,
        parentId,
        category,
        file: draft.file,
        durationSeconds: draft.durationSeconds,
        idempotencyKey: draft.idempotencyKey,
        onProgress: (nextProgress) => {
          setProgress(nextProgress);
          onChange?.({
            ...draft,
            status: nextProgress?.stage === 'processing' ? 'processing' : 'uploading',
            resumeUpload: nextProgress?.resumeUpload || draft.resumeUpload || null,
          });
        },
      });
      onChange?.({
        ...draft,
        status: 'submitted',
        resumeUpload: null,
        uploadedTour: result,
      });
      onUploaded?.(result);
    } catch (failure) {
      const message = userFacingError(failure, 'We could not upload this Peek. Your listing is still safe.');
      setError(message);
      onChange?.({
        ...draft,
        status: 'failed',
        error: message,
      });
      onUploadFailed?.(failure);
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <section className="space-y-4" aria-label={resolvedHeading}>
      <div>
        <p className="text-sm font-semibold text-foreground">{resolvedHeading}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {isResponse
            ? `Record current visual evidence for this ${parentLabel} and the buyer request.`
            : `Add a current video Peek for this ${parentLabel}. You can upload or record one now.`}
        </p>
      </div>

      <TourRecordingGuide category={category} />

      {!draft ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-24 justify-start gap-3 rounded-2xl p-4 text-left"
            disabled={disabled || selecting}
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload className="h-5 w-5 shrink-0" />
            <span>
              <span className="block font-semibold">Upload a video</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">MP4, MOV or WebM, up to 2 minutes</span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-24 justify-start gap-3 rounded-2xl p-4 text-left"
            disabled={disabled || selecting}
            onClick={openCamera}
          >
            <Camera className="h-5 w-5 shrink-0" />
            <span>
              <span className="block font-semibold">Record now</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Use your device camera for a current Peek</span>
            </span>
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            accept={TOUR_ALLOWED_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={choose}
          />
          <input
            ref={recordInputRef}
            type="file"
            accept={TOUR_ALLOWED_MIME_TYPES.join(',')}
            capture="environment"
            className="sr-only"
            onChange={choose}
          />
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          {draft.previewUrl ? (
            <video
              src={draft.previewUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-xl bg-black object-contain"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl bg-muted">
              <Film className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold">{draft.file?.name || 'Selected video'}</p>
              <p className="text-muted-foreground">{durationLabel(draft.durationSeconds)} · {sizeLabel(draft.file?.size)}</p>
            </div>
            {!uploading && draft.status !== 'submitted' && (
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                <Trash2 className="mr-2 h-4 w-4" />Remove
              </Button>
            )}
          </div>

          {progress && <TourUploadProgress progress={progress} />}

          {draft.status === 'failed' && !uploading && (
            <Button type="button" variant="outline" className="w-full" onClick={upload}>
              <RotateCcw className="mr-2 h-4 w-4" />Retry upload
            </Button>
          )}

          {draft.status !== 'submitted' && draft.status !== 'failed' && (
            <Button type="button" className="w-full" disabled={disabled || uploading || selecting || !parentId} onClick={upload}>
              {uploading ? 'Uploading…' : isResponse ? 'Submit Response Peek' : 'Upload Peek'}
              {!uploading && <ChevronRight className="ml-2 h-4 w-4" />}
            </Button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {onSkip && !draft && (
        <Button type="button" variant="ghost" className="w-full" disabled={disabled || selecting || uploading} onClick={onSkip}>
          Skip for now
        </Button>
      )}

      <CameraPermissionDialog
        open={cameraExplanationOpen}
        onOpenChange={setCameraExplanationOpen}
        onContinue={continueToCamera}
      />
    </section>
  );
}
