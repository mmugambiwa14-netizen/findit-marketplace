import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Images, LoaderCircle, Play, RotateCcw, VideoOff } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import TourReportAction from "@/components/tours/TourReportAction";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getPublicTourPlayback } from "@/services/listingToursService";

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remainder = Math.floor(total % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function normalisePhoto(photo) {
  if (typeof photo === "string") return photo;
  return photo?.url || photo?.public_url || photo?.signed_url || null;
}

function normalizePlayback(playback) {
  if (!playback?.tourId || !playback?.playbackUrl) return null;
  return {
    id: playback.tourId,
    playbackUrl: playback.playbackUrl,
    thumbnailUrl: playback.thumbnailUrl || null,
    durationSeconds: Number(playback.durationSeconds) || null,
    mimeType: playback.mimeType || "video/mp4",
  };
}

export default function ListingMediaViewer({
  photos = [],
  title = "Listing",
  fallbackImage = null,
  tour = null,
  tourActionLabel = "Watch Peek",
  tourOwnerId = null,
  parentType = "listing",
  parentId = null,
  className = null,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const images = useMemo(() => {
    const normalised = photos.map(normalisePhoto).filter(Boolean);
    return normalised.length ? normalised : (fallbackImage ? [fallbackImage] : []);
  }, [fallbackImage, photos]);

  const [tourReported, setTourReported] = useState(false);
  const [mode, setMode] = useState("photos");
  const [playback, setPlayback] = useState(null);
  const [playbackState, setPlaybackState] = useState("idle");
  const [playbackError, setPlaybackError] = useState("");
  const [current, setCurrent] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  const hasTour = !tourReported && tour?.status === "ready" && Boolean(tour?.id || tour?.tourId || tour?.tour_id);
  const requestedTour = searchParams.get("media") === "tour";
  const posterUrl = playback?.thumbnailUrl || tour?.thumbnailUrl || tour?.thumbnail_url || images[0] || fallbackImage;

  useEffect(() => {
    setTourReported(false);
    setPlayback(null);
    setPlaybackState("idle");
    setPlaybackError("");
    setMode("photos");
  }, [tour?.id, tour?.tourId, tour?.tour_id, parentId]);

  useEffect(() => {
    if (current >= images.length) setCurrent(0);
    setImageFailed(false);
  }, [current, images.length]);

  useEffect(() => {
    if (!hasTour && mode === "tour") setMode("photos");
  }, [hasTour, mode]);

  const updateMediaQuery = (nextMode) => {
    const next = new URLSearchParams(searchParams);
    if (nextMode === "tour") next.set("media", "tour");
    else next.delete("media");
    setSearchParams(next, { replace: true });
  };

  const loadPlayback = async ({ force = false } = {}) => {
    if (!hasTour || !parentId) return;
    if (playback && !force) return;
    setPlaybackState("loading");
    setPlaybackError("");
    try {
      const nextPlayback = normalizePlayback(await getPublicTourPlayback(parentType, parentId));
      if (!nextPlayback) throw new Error("Peek playback is unavailable.");
      setPlayback(nextPlayback);
      setPlaybackState("ready");
    } catch (error) {
      setPlayback(null);
      setPlaybackState("error");
      setPlaybackError(error.message || "Peek playback is unavailable.");
    }
  };

  const openTour = async () => {
    setMode("tour");
    updateMediaQuery("tour");
    await loadPlayback();
  };

  const showPhotos = () => {
    setMode("photos");
    updateMediaQuery("photos");
  };

  const retryPlayback = async () => {
    setPlayback(null);
    await loadPlayback({ force: true });
  };

  const previous = () => {
    setImageFailed(false);
    setCurrent((index) => (index === 0 ? images.length - 1 : index - 1));
  };
  const next = () => {
    setImageFailed(false);
    setCurrent((index) => (index === images.length - 1 ? 0 : index + 1));
  };

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden border-b border-border bg-surface-secondary md:rounded-b-3xl md:border-x",
        className,
      )}
      aria-label={`${title} media`}
    >
      <div className="relative aspect-[4/3] min-h-[250px] w-full bg-surface-secondary sm:aspect-[16/10] md:aspect-[16/9]">
        {mode === "tour" ? (
          <TourPanel
            title={title}
            playback={playback}
            posterUrl={posterUrl}
            state={playbackState}
            error={playbackError}
            onRetry={retryPlayback}
            onPlaybackError={() => {
              setPlayback(null);
              setPlaybackState("error");
              setPlaybackError("The playback link expired or the video could not be loaded.");
            }}
          />
        ) : images.length > 0 && !imageFailed ? (
          <img
            src={images[current]}
            alt={`${title}, photo ${current + 1} of ${images.length}`}
            className="h-full w-full object-cover"
            loading={current === 0 ? "eager" : "lazy"}
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
              <ImageOff className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="text-sm">Media is unavailable for this listing.</p>
          </div>
        )}

        {mode === "photos" && images.length > 1 && (
          <>
            <MediaArrow label="Previous photo" side="left" onClick={previous}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </MediaArrow>
            <MediaArrow label="Next photo" side="right" onClick={next}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </MediaArrow>
          </>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {hasTour && mode !== "tour" && (
              <Button
                type="button"
                size="sm"
                onClick={openTour}
                className={cn(
                  "min-h-11 rounded-full bg-primary px-4 shadow-lg shadow-black/30",
                  requestedTour && "ring-2 ring-white/70 ring-offset-2 ring-offset-black/40",
                )}
              >
                <Play className="mr-2 h-4 w-4 fill-current" aria-hidden="true" />
                {requestedTour ? `Play ${tourActionLabel.toLowerCase()}` : tourActionLabel}
                {tour?.durationSeconds || tour?.duration_seconds
                  ? ` · ${formatDuration(tour.durationSeconds || tour.duration_seconds)}`
                  : ""}
              </Button>
            )}
            {mode === "tour" && images.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={showPhotos}
                className="min-h-11 rounded-full bg-card/90 px-4 backdrop-blur-md"
              >
                <Images className="mr-2 h-4 w-4" aria-hidden="true" />
                Photos
              </Button>
            )}
          </div>

          {mode === "tour" && playbackState === "ready" ? (
            <TourReportAction
              tourId={playback?.id || tour?.id || tour?.tourId || tour?.tour_id}
              title={title}
              sellerId={tourOwnerId}
              onReported={() => {
                setTourReported(true);
                setPlayback(null);
                showPhotos();
              }}
            />
          ) : mode === "photos" && images.length > 0 ? (
            <span className="rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              {current + 1} / {images.length}
            </span>
          ) : null}
        </div>
      </div>

      {mode === "photos" && images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-border bg-card p-3" aria-label="Photo thumbnails">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => {
                setCurrent(index);
                setImageFailed(false);
              }}
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === current ? "true" : undefined}
              className={cn(
                "h-16 w-20 flex-none overflow-hidden rounded-xl border-2 bg-surface-secondary transition",
                index === current ? "border-primary" : "border-transparent hover:border-border-strong",
              )}
            >
              <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function MediaArrow({ label, side, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {children}
    </button>
  );
}

function TourPanel({ title, playback, posterUrl, state, error, onRetry, onPlaybackError }) {
  if (state === "ready" && playback?.playbackUrl) {
    return (
      <video
        className="h-full w-full bg-black object-contain"
        controls
        playsInline
        preload="metadata"
        poster={posterUrl || undefined}
        aria-label={`${title} Peek video`}
        onError={onPlaybackError}
      >
        <source src={playback.playbackUrl} type={playback.mimeType || "video/mp4"} />
        Your browser does not support video playback.
      </video>
    );
  }

  const loading = state === "loading";
  return (
    <div className="relative flex h-full items-center justify-center bg-black">
      {posterUrl && <img src={posterUrl} alt="" loading="eager" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
      <div className="relative z-10 mx-6 max-w-sm rounded-2xl border border-white/10 bg-black/65 p-5 text-center text-white backdrop-blur-md">
        {loading ? (
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin" aria-hidden="true" />
        ) : (
          <VideoOff className="mx-auto h-8 w-8" aria-hidden="true" />
        )}
        <p className="mt-3 font-semibold">{loading ? "Loading Peek" : "Peek playback unavailable"}</p>
        <p className="mt-1 text-sm text-white/70">
          {loading ? "A secure playback link is being prepared." : error || "The secure playback link could not be prepared."}
        </p>
        {!loading && (
          <Button type="button" size="sm" variant="secondary" className="mt-4" onClick={onRetry}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Retry playback
          </Button>
        )}
      </div>
    </div>
  );
}
