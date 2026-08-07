import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

const MEDIA_CONTROLS_EVENT = "findit:media-controls-visibility";

export default function ListingDetailActions({ onBack }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleVisibility = (event) => {
      const detail = event?.detail || {};
      setVisible(detail.active === true ? detail.visible !== false : true);
    };
    window.addEventListener(MEDIA_CONTROLS_EVENT, handleVisibility);
    return () => window.removeEventListener(MEDIA_CONTROLS_EVENT, handleVisibility);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 safe-area-top md:hidden">
      <div className="mx-auto flex max-w-4xl items-center px-3 py-3">
        <button
          type="button"
          aria-label="Go back"
          onClick={onBack}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-xl transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
