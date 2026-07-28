import ServiceCard from "./ServiceCard";
import { Briefcase } from "lucide-react";

export default function ServiceGrid({ services, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card animate-pulse">
            <div className="aspect-[4/3] bg-surface-raised" />
            <div className="p-3.5 space-y-2">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
          <Briefcase className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="font-medium">No services found</p>
        <p className="text-sm text-muted-foreground">Try a different category or check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </div>
  );
}