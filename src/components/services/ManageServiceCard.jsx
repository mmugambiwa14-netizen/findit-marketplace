import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Trash2, Pause, Play, Loader2, Pencil } from "lucide-react";
import EditServiceDialog from "@/components/services/EditServiceDialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getServiceCategory } from "@/lib/serviceConstants";
import { useCurrency } from "@/lib/CurrencyContext";
import { toast } from "sonner";
import { deleteService, setServiceStatus } from "@/services/servicesService";
import { useAuth } from "@/lib/AuthContext";
import { invalidateCanonicalParentQueries } from "@/lib/canonicalQueryInvalidation";

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  unavailable: "bg-muted text-muted-foreground",
};

/**
 * @param {{ service: any, onChanged?: () => void }} props
 */
export default function ManageServiceCard({ service, onChanged }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { format } = useCurrency();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const category = getServiceCategory(service.category);
  const Icon = category?.icon;

  const priceDisplay =
    service.pricing_type === "quote" || !service.price
      ? "Contact for quote"
      : `${service.pricing_type === "starting_from" ? "From " : ""}${format(service.price)}${service.pricing_type === "hourly" ? "/hr" : ""}`;

  const refresh = async () => {
    await invalidateCanonicalParentQueries(queryClient, { parentType: "service", parentId: service.id });
    onChanged?.();
  };

  const toggleStatus = async () => {
    setBusy(true);
    const next = service.status === "active" ? "paused" : "active";
    try {
      await setServiceStatus(user.id, service.id, next);
      toast.success(next === "active" ? "Service activated" : "Service paused");
      await refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteService(user.id, service.id);
      toast.success("Service deleted");
      await refresh();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button type="button" onClick={() => navigate(`/service/${service.id}`)} className="w-full text-left flex gap-3 p-3">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
          {service.photos?.[0] ? (
            <img src={service.photos[0]} alt={service.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${category?.color || "bg-muted"}`}>
              {Icon && <Icon className="w-8 h-8 text-white/90" />}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge className={`text-[10px] border-transparent ${STATUS_STYLES[service.status] || STATUS_STYLES.unavailable}`}>
              {service.status}
            </Badge>
            {category && <Badge variant="secondary" className="text-[10px]">{category.label}</Badge>}
          </div>
          <h3 className="font-semibold text-sm line-clamp-1">{service.title}</h3>
          <p className="text-primary font-bold text-sm mt-1">{priceDisplay}</p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            {service.location_name && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {service.location_name}</span>
            )}
          </div>
        </div>
      </button>

      <div className="flex border-t border-border divide-x divide-border">
        <button type="button"
          onClick={() => setEditOpen(true)}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
        <button type="button"
          onClick={toggleStatus}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : service.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {service.status === "active" ? "Pause" : "Activate"}
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button"
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this service?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes "{service.title}". This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <EditServiceDialog
        service={service}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={refresh}
      />
    </div>
  );
}
