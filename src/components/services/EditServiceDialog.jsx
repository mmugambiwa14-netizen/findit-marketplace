import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PRICING_TYPES } from "@/lib/serviceConstants";
import { toast } from "sonner";
import { invalidateCanonicalParentQueries } from "@/lib/canonicalQueryInvalidation";
import { updateService } from "@/services/servicesService";
import { removeStagedMarketplaceImage, uploadMarketplaceImage } from "@/services/marketplaceImagesService";
import { useAuth } from "@/lib/AuthContext";
import TourManagementPanel from "@/components/tours/TourManagementPanel";

function serviceForm(service) {
  return {
    title: service.title || "",
    description: service.description || "",
    pricing_type: service.pricing_type || "starting_from",
    price: service.price ?? "",
    contact_phone: service.contact_phone || "",
    contact_whatsapp: service.contact_whatsapp || "",
    contact_email: service.contact_email || "",
  };
}

export default function EditServiceDialog({ service, open, onOpenChange, onSaved }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imageInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tourBusy, setTourBusy] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [media, setMedia] = useState([]);
  const [form, setForm] = useState(() => serviceForm(service));

  useEffect(() => {
    if (!open) return;
    setForm(serviceForm(service));
    setMediaError("");
    if (service.has_legacy_media) {
      setMedia((service.photos || []).map((previewUrl, index) => ({
        path: `legacy-${index}`,
        previewUrl,
        existing: true,
        legacy: true,
      })));
      return;
    }
    setMedia((service.photo_paths || []).map((path, index) => ({
      path,
      previewUrl: service.photos?.[index] || "",
      existing: true,
    })));
  }, [open, service]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || service.has_legacy_media) return;
    if (media.length + files.length > 6) {
      setMediaError("A service can contain up to 6 images.");
      return;
    }
    setUploading(true);
    setMediaError("");
    for (const file of files) {
      try {
        const uploaded = await uploadMarketplaceImage(file, "service_photo");
        setMedia((current) => [...current, { ...uploaded, existing: false }]);
      } catch (error) {
        setMediaError(error.message || `Could not upload ${file.name}`);
      }
    }
    setUploading(false);
  };

  const removeImage = async (item) => {
    if (item.legacy) return;
    if (item.existing) {
      setMedia((current) => current.filter((candidate) => candidate.path !== item.path));
      return;
    }
    try {
      await removeStagedMarketplaceImage(item.path, "service_photo");
      setMedia((current) => current.filter((candidate) => candidate.path !== item.path));
    } catch (error) {
      setMediaError(error.message || "Could not remove the image.");
    }
  };

  const handleOpenChange = async (nextOpen) => {
    if (!nextOpen) {
      if (uploading || tourBusy) {
        toast.error(tourBusy ? "Wait for the Tour upload to finish" : "Wait for the image upload to finish");
        return;
      }
      const staged = media.filter((item) => !item.existing);
      await Promise.all(staged.map((item) => (
        removeStagedMarketplaceImage(item.path, "service_photo").catch(() => {})
      )));
    }
    onOpenChange(nextOpen);
  };

  const save = async () => {
    if (form.title.trim().length < 3) {
      toast.error("Title must be at least 3 characters");
      return;
    }
    if (form.title.trim().length > 160 || form.description.trim().length > 5000) {
      toast.error("Title or description is too long");
      return;
    }
    if (!form.contact_phone.trim() && !form.contact_whatsapp.trim()) {
      toast.error("Add a phone or WhatsApp number");
      return;
    }
    setSaving(true);
    try {
      const initialPaths = service.photo_paths || [];
      const keepPaths = media.filter((item) => item.existing && !item.legacy).map((item) => item.path);
      const uploads = media.filter((item) => !item.existing);
      const mediaChanged = !service.has_legacy_media && (
        uploads.length > 0
        || keepPaths.length !== initialPaths.length
        || keepPaths.some((path, index) => path !== initialPaths[index])
      );
      await updateService(user.id, service.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        pricing_type: form.pricing_type,
        price: form.pricing_type === "quote" ? null : Number(form.price) || 0,
        contact_phone: form.contact_phone.trim(),
        contact_whatsapp: form.contact_whatsapp.trim(),
        contact_email: form.contact_email.trim(),
      }, mediaChanged ? { keepPaths, uploads } : null);
      toast.success("Service updated");
      await invalidateCanonicalParentQueries(queryClient, { parentType: "service", parentId: service.id });
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.message || "Failed to update service");
      if (error.partial) {
        await invalidateCanonicalParentQueries(queryClient, { parentType: "service", parentId: service.id });
        onSaved?.();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-service-title">Title</Label>
            <Input id="edit-service-title" maxLength={160} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-service-description">Description</Label>
            <Textarea
              id="edit-service-description"
              maxLength={5000}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="h-28"
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label>Service images <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {service.has_legacy_media
                  ? "Existing legacy images are preserved until their source objects are migrated."
                  : "JPG, PNG, or WebP · 5 MB each · up to 6."}
              </p>
            </div>
            {!service.has_legacy_media && (
              <>
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading || saving || media.length >= 6} className="flex min-h-24 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 text-center hover:border-primary/50 disabled:opacity-60">
                  {uploading ? <><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="mt-2 text-sm">Validating and uploading…</span></> : <><Camera className="h-7 w-7 text-muted-foreground" /><span className="mt-2 text-sm font-semibold">Add service images</span></>}
                </button>
                <input ref={imageInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadImages} />
              </>
            )}
            {media.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {media.map((item, index) => (
                  <div key={item.path} className="relative aspect-square overflow-hidden rounded-xl border">
                    <img src={item.previewUrl} alt={`Service image ${index + 1}`} className="h-full w-full object-cover" />
                    {!item.legacy && <Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2 h-9 w-9" onClick={() => removeImage(item)} disabled={saving} aria-label={`Remove service image ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </div>
            )}
            {mediaError && <p role="alert" className="text-sm text-destructive">{mediaError}</p>}
          </div>

          {service.category !== "legal" && (
            <TourManagementPanel
              parentType="service"
              parentId={service.id}
              category="service"
              onBusyChange={setTourBusy}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-service-pricing">Pricing</Label>
              <Select value={form.pricing_type} onValueChange={(v) => set("pricing_type", v)}>
                <SelectTrigger id="edit-service-pricing"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICING_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-service-price">Price ({service.currency || "USD"})</Label>
              <Input
                id="edit-service-price"
                type="number"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                disabled={form.pricing_type === "quote"}
                placeholder={form.pricing_type === "quote" ? "—" : "0"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-service-phone">Phone</Label>
            <Input id="edit-service-phone" name="phone" type="tel" autoComplete="tel" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-service-whatsapp">WhatsApp</Label>
            <Input id="edit-service-whatsapp" name="whatsapp" type="tel" autoComplete="tel" value={form.contact_whatsapp} onChange={(e) => set("contact_whatsapp", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-service-email">Contact email</Label>
            <Input id="edit-service-email" name="email" type="email" autoComplete="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving || uploading || tourBusy}>Cancel</Button>
          <Button onClick={save} disabled={saving || uploading || tourBusy}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
