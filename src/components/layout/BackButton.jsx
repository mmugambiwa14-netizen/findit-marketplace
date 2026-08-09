import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { goBackOrHome } from "@/lib/navigation";

// Reusable back button. Goes to the previous page in history,
// or falls back to `fallback` (default "/") when there is none.
export default function BackButton({ fallback = "/", className = "" }) {
  const navigate = useNavigate();

  const handleBack = () => {
    goBackOrHome(navigate, fallback);
  };

  return (
    <button type="button"
      onClick={handleBack}
      aria-label="Go back"
      className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );
}
