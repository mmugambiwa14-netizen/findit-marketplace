import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Images,
  LoaderCircle,
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import TourReportAction from "@/components/tours/TourReportAction";
import { Button } from "@/components/ui/button";
import ImageLightbox from "@/components/ui/image-lightbox";
import { cn } from "@/lib/utils";
import { getPublicTourPlayback } from "@/services/listingToursService";

const MEDIA_CONTROLS_EVENT = "findit:media-controls-visibility";

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
  tourActionLabel = "Take a Peek",
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
  const [controlsVisible, setControlsVisible] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const hasTour = !tourReported && tour?.status === "ready" && Boolean(tour?.id || tour?.tourId || tour?.tour_id);
  const requestedTour = searchParams.get("media") === "tour";
  const posterUrl = playback?.thumbnailUrl || tour?.thumbnailUrl || tour?.thumbnail_url || images[0] || fallbackImage;
  const tourDuration = tour?.durationSeconds || tour?.duration_seconds;

  useEffect(() => {
    setTourReported(false);
    setPlayback(null);
    setPlaybackState("idle");
    setPlaybackError("");
    setMode("photos");
    setControlsVisible(true);
  }, [tour?.id, tour?.tourId, tour?.tour_id, parentId]);

  useEffect(() => {
    if (current >= images.length) setCurrent(0);
    setImageFailed(false);
  }, [current, images.length]);

  useEffect(() => {
    if (!hasTour && mode === "tour") setMode("photos");
  }, [hasTour, mode]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MEDIA_CONTROLS_EVENT, {
      detail: {
        active: mode === "tour" && playbackState === "ready",
        visible: mode !== "tour" || controlsVisible,
      },
    }));
  }, [controlsVisible, mode, playbackState]);

  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent(MEDIA_CONTROLS_EVENT, {
      detail: { active: false, visible: true },
    }));
  }, []);

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
    setControlsVisible(true);
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
    setControlsVisible(true);
    updateMediaQuery("tour");
    await loadPlayback();
  };

  const showPhotos = () => {
    setMode("photos");
    setControlsVisible(true);
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
            controlsVisible={controlsVisible}
            onControlsVisibleChange={setControlsVisible}
            onRetry={retryPlayback}
            onPlaybackError={() => {
              setPlayback(null);
              setPlaybackState("error");
              setPlaybackError("The playback link expired or the video could not be loaded.");
              setControlsVisible(true);
            }}
          />
        ) : images.length > 0 && !imageFailed ? (
          <button
            type="button"
            aria-label={`Expand photo ${current + 1} of ${images.length}`}
            onClick={() => setLightboxOpen(true)}
            className="group block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <img
              src={images[current]}
              alt={`${title}, photo ${current + 1} of ${images.length}`}
              className="h-full w-full object-cover"
              loading={current === 0 ? "eager" : "lazy"}
              decoding="async"
              onError={() => setImageFailed(true)}
            />
            <span className="pointer-events-none absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white opacity-90 backdrop-blur-md transition group-hover:bg-black/80 sm:right-4 sm:top-4">
              <Maximize className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
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
      </div>

      {(hasTour || (mode === "photos" && images.length > 1)) && (
        <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border bg-card px-3 py-2.5 sm:px-4">
          <div className="inline-flex min-w-0 items-center gap-1 rounded-xl bg-surface-secondary p-1">
            {images.length > 0 && (
              <button
                type="button"
                onClick={showPhotos}
                aria-pressed={mode === "photos"}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  mode === "photos" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Images className="h-4 w-4" aria-hidden="true" />
                Photos
              </button>
            )}
            {hasTour && (
              <button
                type="button"
                onClick={openTour}
                aria-label={requestedTour ? "Play Peek" : tourActionLabel}
                aria-pressed={mode === "tour"}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  mode === "tour" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Peek{tourDuration ? ` · ${formatDuration(tourDuration)}` : ""}
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {mode === "photos" && images.length > 0 && (
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {current + 1} of {images.length}
              </span>
            )}
            {mode === "tour" && playbackState === "ready" && (
              <TourReportAction
                tourId={playback?.id || tour?.id || tour?.tourId || tour?.tour_id}
                title={title}
                sellerId={tourOwnerId}
                variant="surface"
                className="min-h-10"
                onReported={() => {
                  setTourReported(true);
                  setPlayback(null);
                  showPhotos();
                }}
              />
            )}
          </div>
        </div>
      )}

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

      <ImageLightbox
        images={images}
        index={current}
        onIndexChange={(nextIndex) => {
          setImageFailed(false);
          setCurrent(nextIndex);
        }}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        title={title}
      />
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

function PlayerIconButton({ label, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur-md transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function TourPanel({ title, playback, posterUrl, state, error, controlsVisible, onControlsVisibleChange, onRetry, onPlaybackError }) {
  const videoRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [pipAvailable, setPipAvailable] = useState(false);

  const clearHideTimer = () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  };

  useEffect(() => {
    clearHideTimer();
    if (!paused && controlsVisible) {
      hideTimerRef.current = window.setTimeout(() => onControlsVisibleChange(false), 3000);
    }
    return clearHideTimer;
  }, [controlsVisible, onControlsVisibleChange, paused]);

  useEffect(() => () => clearHideTimer(), []);

  const toggleControls = () => {
    clearHideTimer();
    onControlsVisibleChange((visible) => !visible);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const openPictureInPicture = async () => {
    const video = videoRef.current;
    if (!video?.requestPictureInPicture) return;
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      // Browser support can change after playback starts; leave the player usable.
    }
  };

  const openFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (video.requestFullscreen) await video.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch {
      // Fullscreen is optional and must never interrupt playback.
    }
  };

  if (state === "ready" && playback?.playbackUrl) {
    return (
      <div className="relative h-full w-full touch-manipulation bg-black">
        <video
          ref={videoRef}
          className="h-full w-full cursor-pointer bg-black object-contain"
          playsInline
          preload="metadata"
          poster={posterUrl || undefined}
          aria-label={`${title} Peek video. Tap to ${controlsVisible ? "hide" : "show"} controls.`}
          onClick={toggleControls}
          onLoadedMetadata={(event) => {
            setDuration(Number(event.currentTarget.duration) || 0);
            setCurrentTime(Number(event.currentTarget.currentTime) || 0);
            setMuted(event.currentTarget.muted);
            setPipAvailable(Boolean(document.pictureInPictureEnabled && event.currentTarget.requestPictureInPicture));
          }}
          onTimeUpdate={(event) => setCurrentTime(Number(event.currentTarget.currentTime) || 0)}
          onPlay={() => setPaused(false)}
          onPause={() => {
            setPaused(true);
            onControlsVisibleChange(true);
          }}
          onEnded={() => {
            setPaused(true);
            onControlsVisibleChange(true);
          }}
          onError={onPlaybackError}
        >
          <source src={playback.playbackUrl} type={playback.mimeType || "video/mp4"} />
          Your browser does not support video playback.
        </video>

        {controlsVisible && (
          <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/55 via-transparent to-black/25" aria-hidden="false">
            {paused && (
              <button
                type="button"
                aria-label="Play Peek"
                onClick={(event) => {
                  event.stopPropagation();
                  togglePlayback();
                }}
                className="pointer-events-auto absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white shadow-xl backdrop-blur-md transition hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Play className="ml-1 h-7 w-7 fill-current" aria-hidden="true" />
              </button>
            )}

            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 sm:right-4">
              {pipAvailable && (
                <PlayerIconButton label="Picture in picture" onClick={openPictureInPicture}>
                  <PictureInPicture2 className="h-4.5 w-4.5" aria-hidden="true" />
                </PlayerIconButton>
              )}
              <PlayerIconButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
                {muted ? <VolumeX className="h-4.5 w-4.5" aria-hidden="true" /> : <Volume2 className="h-4.5 w-4.5" aria-hidden="true" />}
              </PlayerIconButton>
              <PlayerIconButton label="Fullscreen" onClick={openFullscreen}>
                <Maximize className="h-4.5 w-4.5" aria-hidden="true" />
              </PlayerIconButton>
            </div>

            {/* Full-bleed controls sit on the video itself rather than in a panel.
                The gradient is the only thing keeping the white time text and
                icons legible over bright footage, so it must not be removed. */}
            <div className="pointer-events-auto absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pb-3 pt-10 text-white sm:px-4 sm:pb-4">
              <input
                type="range"
                min="0"
                max={Math.max(duration, 0)}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => {
                  const video = videoRef.current;
                  if (!video) return;
                  const nextTime = Number(event.target.value) || 0;
                  video.currentTime = nextTime;
                  setCurrentTime(nextTime);
                }}
                aria-label="Peek progress"
                className="h-1.5 w-full cursor-pointer accent-primary"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold">
                <button
                  type="button"
                  aria-label={paused ? "Play Peek" : "Pause Peek"}
                  onClick={togglePlayback}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {paused ? <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" /> : <Pause className="h-4 w-4 fill-current" aria-hidden="true" />}
                </button>
                <span className="tabular-nums text-white/85">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
                <span className="text-[10px] font-medium text-white/60">Tap video to hide</span>
              </div>
            </div>
          </div>
        )}
      </div>
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
