import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function SectionHeader({ title, icon: Icon, linkTo, linkLabel = "See All" }) {
  return (
    <div className="mb-4 flex items-center justify-between px-4">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="w-[18px] h-[18px] text-primary" strokeWidth={2.25} />
          </div>
        )}
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          {linkLabel}
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}
