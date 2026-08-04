import { useRef, useState } from 'react';
import { Camera, ChevronRight, Film, RotateCcw, Trash2, Upload } from 'lucide-react';
import CameraPermissionDialog from '@/components/permissions/CameraPermissionDialog';
import { Button } from '@/components/ui/button';
import { readStoredString, writeStoredString } from '@/lib/browserStorage';
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

const CAMERA_EXPLANATION_KEY = 'findit.camera-explanation-seen';

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

  const openCamera = () => {
    if (readStoredString('local', CAMERA_EXPLANATION_KEY) === '1') {
      recordInputRef.current?.click();
      return;
    }
    setCameraExplanationOpen(true);
  };

  const continueToCamera = () => {
    writeStoredString('local', CAMERA_EXPLANATION_KEY, '1');
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
        file: draft.file,
        durationSeconds: draft.durationSeconds,
        idempotencyKey: draft.idempotencyKey,
      }, {
        resumeUpload: draft.resumeUpload,
        onProgress: (next) => {
          setProgress(next);
          onChange?.({ ...draft, status: 'uploading', progress: next });
        },
      });
      const completed = {
        ...draft,
        status: 'uploaded',
        tourId: result.tourId,
        peekKind: isResponse ? 'response' : 'main',
        progress: { percent: 100, message: isResponse ? 'Preparing Response Peek' : 'Preparing Peek' },
        resumeUpload: null,
      };
      onChange?.(completed);
      onUploaded?.(result);
    } catch (failure) {
      const message = userFacingError(failure, 'The upload did not finish. Check your connection and try again.');
      const failed = {
        ...draft,
        status: 'error',
        error: message,
        resumeUpload: failure?.resumeUpload || draft.resumeUpload || null,
      };
      onChange?.(failed);
      setError(message);
      onUploadFailed?.(failure);
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="tour-uploader-heading">
      <div>
        <h3 id="tour-uploader-heading" className="font-semibold">{resolvedHeading} {!isResponse && <span className="font-normal text-muted-foreground">— optional</span>}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isResponse
            ? 'Record clear visual evidence for one or more Buyer Peek Requests. Up to 2 minutes and 250 MB.'
            : 'One video, up to 2 minutes and 250 MB. The public version is processed to 720p.'}
        </p>
      </div>
      <TourRecordingGuide category={category} parentType={parentType} />
      <input ref={uploadInputRef} className="hidden" type="file" accept={TOUR_ALLOWED_MIME_TYPES.join(',')} onChange={choose} />
      <input ref={recordInputRef} className="hidden" type="file" accept="video/*" capture="environment" onChange={choose} />

      {!draft && (
        <div className={`grid gap-3 ${onSkip ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={openCamera} disabled={disabled || selecting}><Camera />Record</Button>
          <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => uploadInputRef.current?.click()} disabled={disabled || selecting}><Upload />Upload</Button>
          {onSkip && <Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={onSkip} disabled={disabled || selecting}><ChevronRight />Skip</Button>}
        </div>
      )}

      {draft && (
        <div className="overflow-hidden rounded-xl border border-border bg-muted/10">
          <div className="relative aspect-video bg-black">
            <video src={draft.previewUrl} className="h-full w-full object-contain" controls preload="metadata" aria-label="Selected Peek preview" />
            <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-1 text-xs font-semibold text-white">{durationLabel(draft.durationSeconds)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold"><Film className="mr-1 inline h-4 w-4" />{draft.file?.name || 'Selected Peek video'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{sizeLabel(draft.file?.size)} · {durationLabel(draft.durationSeconds)}</p>
            </div>
            {!uploading && draft.status !== 'uploaded' && <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={disabled}><Trash2 />Remove</Button>}
          </div>
        </div>
      )}

      {(uploading || draft?.status === 'uploading') && <TourUploadProgress progress={progress || draft?.progress} />}
      {draft?.status === 'uploaded' && <p className="rounded-xl bg-success/10 p-3 text-sm font-medium text-success">{isResponse ? 'Response Peek uploaded. It will appear when it is ready.' : `Peek uploaded. It will appear on the ${parentLabel} when it is ready.`}</p>}
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {draft && parentId && draft.status !== 'uploaded' && !uploading && (
        <Button type="button" className="h-11 w-full rounded-xl" onClick={upload} disabled={disabled || selecting}>
          {draft.status === 'error' ? <><RotateCcw />Try upload again</> : <><Upload />{isResponse ? 'Upload Response Peek' : 'Upload Peek'}</>}
        </Button>
      )}
      {draft && !parentId && <p className="text-xs text-muted-foreground">The video will upload after the {parentLabel} is created.</p>}
      {!draft && !isResponse && <p className="text-center text-xs text-muted-foreground">You can skip this and add or replace a Peek later from {managementLabel}.</p>}

      <CameraPermissionDialog
        open={cameraExplanationOpen}
        onOpenChange={setCameraExplanationOpen}
        onContinue={continueToCamera}
      />
    </section>
  );
}
