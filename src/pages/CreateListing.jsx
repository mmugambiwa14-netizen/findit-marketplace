import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { GuestGate } from '@/components/create-listing/GuestGate';
import ListingDetailsStep from '@/components/create-listing/ListingDetailsStep';
import ListingLocationStep from '@/components/create-listing/ListingLocationStep';
import ListingMediaContactStep from '@/components/create-listing/ListingMediaContactStep';
import ListingReviewStep from '@/components/create-listing/ListingReviewStep';
import PublishSuccess from '@/components/create-listing/PublishSuccess';
import Step1Category from '@/components/create-listing/Step1Category';
import StepProgress from '@/components/create-listing/StepProgress';
import { usePersistentFormDraft } from '@/hooks/usePersistentFormDraft';
import { useAuth } from '@/lib/AuthContext';
import { customerErrorMessage } from '@/lib/customerErrors';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import { goBackOrHome } from '@/lib/navigation';
import { resolveListingImages, submitListing } from '@/services/listingCreationService';
import { removeListingTour, uploadListingTour } from '@/services/listingToursService';
import { getActiveLocations } from '@/services/locationsService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

function freshForm(user) {
  return {
    submission_key: crypto.randomUUID(),
    country_code: LAUNCH_COUNTRY_CODE,
    currency: 'USD',
    contact_phone: user?.phone || '',
    contact_whatsapp: user?.phone || '',
    contact_email: user?.email || '',
    detail: {},
  };
}

export default function CreateListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const draftKey = user?.id ? `findit_listing_draft_v2_${user.id}` : null;
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(() => freshForm(user));
  const [media, setMedia] = useState([]);
  const [tourDraft, setTourDraft] = useState(null);
  const [submissionProgress, setSubmissionProgress] = useState(null);
  const [retryingTour, setRetryingTour] = useState(false);
  const [discardingTour, setDiscardingTour] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedListing, setSubmittedListing] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const update = (key, value) => setFormData((current) => ({ ...current, [key]: value }));

  const restoreDraft = useCallback((payload) => {
    if (payload?.formData) setFormData({ ...freshForm(user), ...payload.formData });
    if (Array.isArray(payload?.media)) {
      Promise.all(payload.media.map(async (item) => ({
        ...item,
        previewUrl: (await resolveListingImages([item.path]))[0] || item.previewUrl,
      }))).then(setMedia).catch(() => setMedia(payload.media));
    }
    if (Number.isInteger(payload?.step) && payload.step >= 1 && payload.step <= 5) setStep(payload.step);
  }, [user]);

  const draftValue = useMemo(() => ({
    formData,
    media: media.map(({ previewUrl: _previewUrl, ...item }) => item),
    step,
  }), [formData, media, step]);

  const { saveNow, clearDraft } = usePersistentFormDraft({
    storageKey: draftKey,
    value: draftValue,
    onRestore: restoreDraft,
    enabled: !submittedListing,
  });

  useEffect(() => {
    if (!formData.location_id) {
      setLocationName('');
      return undefined;
    }

    let cancelled = false;
    getActiveLocations('city', null, formData.country_code || LAUNCH_COUNTRY_CODE)
      .then((locations) => {
        if (cancelled) return;
        const match = locations.find((item) => item.id === formData.location_id);
        if (match) setLocationName(match.name);
      })
      .catch(() => {
        /* keep the last known good name; the selection itself is unaffected */
      });

    return () => { cancelled = true; };
  }, [formData.country_code, formData.location_id]);

  useEffect(() => () => {
    if (tourDraft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(tourDraft.previewUrl);
  }, [tourDraft?.previewUrl]);

  const isDirty = useMemo(() => Boolean(formData.title || formData.listing_category || media.length || tourDraft), [formData, media.length, tourDraft]);

  useEffect(() => {
    const warn = (event) => {
      if (isDirty && !submittedListing) {
        saveNow();
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, saveNow, submittedListing]);

  const saveDraft = () => {
    if (saveNow()) toast.success('Draft saved on this device');
    else toast.error('This browser could not save the draft on this device.');
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await submitListing(user.id, {
        submissionKey: formData.submission_key,
        kind: formData.listing_category,
        category: formData.category,
        listingType: formData.listing_type,
        title: formData.title,
        description: formData.description,
        price: formData.price,
        currency: formData.currency,
        negotiable: formData.negotiable,
        locationId: formData.location_id,
        contactPhone: formData.contact_phone,
        contactWhatsapp: formData.contact_whatsapp,
        contactEmail: formData.contact_email,
        detail: formData.detail,
        media,
      });
      clearDraft();
      let completedTour = tourDraft;
      if (tourDraft?.file) {
        try {
          const uploaded = await uploadListingTour({
            parentType: 'listing',
            parentId: result.id,
            file: tourDraft.file,
            durationSeconds: tourDraft.durationSeconds,
            idempotencyKey: tourDraft.idempotencyKey,
          }, {
            resumeUpload: tourDraft.resumeUpload,
            onProgress: setSubmissionProgress,
          });
          completedTour = { ...tourDraft, status: 'uploaded', tourId: uploaded.tourId, error: '', resumeUpload: null };
        } catch (tourError) {
          completedTour = {
            ...tourDraft,
            status: 'error',
            error: customerErrorMessage(tourError, 'TOUR_UPLOAD_FAILED'),
            resumeUpload: tourError.resumeUpload || tourDraft.resumeUpload || null,
          };
        }
        setTourDraft(completedTour);
      }
      setSubmittedListing({
        ...result,
        title: formData.title,
        price: Number(formData.price),
        currency: formData.currency,
        photos: media.map((item) => item.previewUrl),
        location_id: locationName,
        tourDraft: completedTour,
      });
    } catch (failure) {
      toast.error(customerErrorMessage(failure, 'LISTING_PUBLISH_FAILED'));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    clearDraft();
    setFormData(freshForm(user));
    if (tourDraft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(tourDraft.previewUrl);
    setMedia([]);
    setTourDraft(null);
    setSubmissionProgress(null);
    setRetryingTour(false);
    setDiscardingTour(false);
    setStep(1);
    setSubmittedListing(null);
  };

  const retryTourUpload = async () => {
    if (!submittedListing?.id || !tourDraft?.file) return;
    setRetryingTour(true);
    setSubmissionProgress(null);
    try {
      const uploaded = await uploadListingTour({
        parentType: 'listing',
        parentId: submittedListing.id,
        file: tourDraft.file,
        durationSeconds: tourDraft.durationSeconds,
        idempotencyKey: tourDraft.idempotencyKey,
      }, {
        resumeUpload: tourDraft.resumeUpload,
        onProgress: setSubmissionProgress,
      });
      const completed = { ...tourDraft, status: 'uploaded', tourId: uploaded.tourId, error: '', resumeUpload: null };
      setTourDraft(completed);
      setSubmittedListing((current) => ({ ...current, tourDraft: completed }));
      toast.success('Peek uploaded and queued for processing');
    } catch (failure) {
      const failed = {
        ...tourDraft,
        status: 'error',
        error: customerErrorMessage(failure, 'TOUR_UPLOAD_FAILED'),
        resumeUpload: failure.resumeUpload || tourDraft.resumeUpload || null,
      };
      setTourDraft(failed);
      setSubmittedListing((current) => ({ ...current, tourDraft: failed }));
      toast.error(failed.error);
    } finally {
      setRetryingTour(false);
    }
  };

  const discardInterruptedTour = async () => {
    if (!tourDraft || discardingTour || retryingTour) return;
    setDiscardingTour(true);
    try {
      if (tourDraft.resumeUpload?.tourId) await removeListingTour(tourDraft.resumeUpload.tourId);
      if (tourDraft.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(tourDraft.previewUrl);
      setTourDraft(null);
      setSubmissionProgress(null);
      setSubmittedListing((current) => current ? { ...current, tourDraft: null } : current);
      toast.success('Unfinished Peek discarded');
    } catch (failure) {
      toast.error(failure.message || 'The unfinished Peek could not be discarded');
    } finally {
      setDiscardingTour(false);
    }
  };

  if (!user) return <GuestGate />;
  if (submittedListing) return (
    <>
      <PublishSuccess listing={submittedListing} onPostAnother={reset} onRetryTour={retryTourUpload} retryingTour={retryingTour} onDiscardTour={() => setConfirmation('discard-tour')} discardingTour={discardingTour} tourProgress={submissionProgress} />
      <CreateListingConfirmation
        mode={confirmation}
        busy={discardingTour}
        onCancel={() => setConfirmation(null)}
        onConfirm={async () => {
          setConfirmation(null);
          if (confirmation === 'discard-tour') await discardInterruptedTour();
        }}
      />
    </>
  );

  return <div className="min-h-screen bg-background pb-16">
    <StepProgress currentStep={step} onSaveDraft={saveDraft} />
    {step === 1 && <div className="mx-auto max-w-[680px] px-4 pt-4"><button type="button" onClick={() => isDirty ? setConfirmation('exit-draft') : goBackOrHome(navigate, '/')} className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Exit</button></div>}
    <div className="mx-auto max-w-[680px] px-4 py-4">
      {step === 1 && <Step1Category formData={formData} update={update} onContinue={() => setStep(2)} />}
      {step === 2 && <ListingDetailsStep formData={formData} update={update} onBack={() => setStep(1)} onContinue={() => setStep(3)} />}
      {step === 3 && <ListingLocationStep formData={formData} update={update} onBack={() => setStep(2)} onContinue={() => setStep(4)} />}
      {step === 4 && <ListingMediaContactStep formData={formData} update={update} media={media} setMedia={setMedia} tourDraft={tourDraft} setTourDraft={setTourDraft} onBack={() => setStep(3)} onContinue={() => setStep(5)} />}
      {step === 5 && <ListingReviewStep formData={formData} media={media} tourDraft={tourDraft} locationName={locationName} onBack={() => setStep(4)} onSubmit={submit} submitting={submitting} submissionProgress={submissionProgress} />}
    </div>
    <CreateListingConfirmation
      mode={confirmation}
      busy={false}
      onCancel={() => setConfirmation(null)}
      onConfirm={() => {
        const mode = confirmation;
        setConfirmation(null);
        if (mode === 'exit-draft') {
          saveNow();
          goBackOrHome(navigate, '/');
        }
      }}
    />
  </div>;
}

function CreateListingConfirmation({ mode, busy, onCancel, onConfirm }) {
  const discardTour = mode === 'discard-tour';
  return (
    <AlertDialog open={Boolean(mode)} onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{discardTour ? 'Discard the unfinished Peek?' : 'Leave this draft?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {discardTour
              ? 'The unfinished Peek upload will be removed. The published listing and its photos will remain.'
              : 'Your listing draft is saved automatically on this device and can be continued later.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Stay here</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={busy}>
            {discardTour ? 'Discard Peek' : 'Leave draft'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
