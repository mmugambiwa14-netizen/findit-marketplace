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
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 safe-area-top">
      <div className="mx-auto flex max-w-4xl items-center px-4 py-3">
        <button
          type="button"
          aria-label="Go back"
          onClick={onBack}
          className="clay-icon pointer-events-auto h-11 w-11 border-white/10 bg-card/90 text-foreground backdrop-blur-xl"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
