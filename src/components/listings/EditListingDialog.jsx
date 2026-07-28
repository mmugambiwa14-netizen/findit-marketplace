import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { invalidateCanonicalParentQueries } from "@/lib/canonicalQueryInvalidation";
import { LocationSelector } from "@/components/location/LocationSelector";
import TourManagementPanel from "@/components/tours/TourManagementPanel";
import { updateOwnerListing } from "@/services/ownerListingsService";
import { changeOwnerListingState, removeStagedListingImage, uploadListingImage } from "@/services/listingCreationService";

function listingForm(listing) {
  return {
    title: listing.title || "",
    price: listing.price ?? "",
    description: listing.description || "",
    location_id: listing.location_ref_id || "",
    contact_phone: listing.contact_phone || "",
    contact_whatsapp: listing.contact_whatsapp || "",
    contact_email: listing.contact_email || "",
  };
}

export default function EditListingDialog({ listing, ownerId, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const imageInputRef = useRef(null);
  const [form, setForm] = useState(() => listingForm(listing));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tourBusy, setTourBusy] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [media, setMedia] = useState([]);
  const canSubmitForReview = ["draft", "rejected", "expired", "unavailable"].includes(listing.status);

  useEffect(() => {
    if (!open) return;
    setForm(listingForm(listing));
    setMediaError("");
    if (listing.has_legacy_media) {
      setMedia((listing.photos || []).map((previewUrl, index) => ({
        path: `legacy-${index}`,
        previewUrl,
        existing: true,
        legacy: true,
      })));
      return;
    }
    setMedia((listing.photo_paths || []).map((path, index) => ({
      path,
      previewUrl: listing.photos?.[index] || "",
      existing: true,
    })));
  }, [listing, open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || listing.has_legacy_media) return;
    if (media.length + files.length > 20) {
      setMediaError("A listing can contain up to 20 images.");
      return;
    }
    setUploading(true);
    setMediaError("");
    for (const file of files) {
      try {
        const uploaded = await uploadListingImage(file);
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
      await removeStagedListingImage(item.path);
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
      await Promise.allSettled(staged.map((item) => removeStagedListingImage(item.path)));
    }
    onOpenChange(nextOpen);
  };

  const save = async (submitForReview) => {
    if (!form.title.trim()) {
      toast.error("A title is required");
      return;
    }
    if (!listing.has_legacy_media && media.length === 0) {
      setMediaError("Keep or add at least one listing image.");
      return;
    }
    setSaving(true);
    try {
      const data = {
        title: form.title.trim(),
        price: form.price === "" ? 0 : Number(form.price),
        description: form.description,
        location_id: form.location_id,
        contact_phone: form.contact_phone,
        contact_whatsapp: form.contact_whatsapp,
        contact_email: form.contact_email,
      };
      const initialPaths = listing.photo_paths || [];
      const keepPaths = media.filter((item) => item.existing && !item.legacy).map((item) => item.path);
      const uploads = media.filter((item) => !item.existing);
      const mediaChanged = !listing.has_legacy_media && (
        uploads.length > 0
        || keepPaths.length !== initialPaths.length
        || keepPaths.some((path, index) => path !== initialPaths[index])
      );
      const updatedListing = await updateOwnerListing(
        ownerId,
        listing._type,
        listing.id,
        data,
        mediaChanged ? { keepPaths, uploads } : null,
      );
      const movedToReview = listing.status !== "pending_review" && updatedListing?.status === "pending_review";
      let submittedForReview = false;
      await invalidateCanonicalParentQueries(queryClient, { parentType: "listing", parentId: listing.id, kind: listing._type });
      if (submitForReview && canSubmitForReview) {
        try {
          await changeOwnerListingState(listing.id, "submit");
          submittedForReview = true;
          await invalidateCanonicalParentQueries(queryClient, { parentType: "listing", parentId: listing.id, kind: listing._type });
        } catch (submitError) {
          toast.error(`Changes saved, but submission failed: ${submitError.message || "try again"}`);
          onOpenChange(false);
          return;
        }
      }
      toast.success(
        movedToReview || submittedForReview
          ? "Changes saved and submitted for review"
          : "Changes saved",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error.message || "Failed to save. Please try again.");
      if (error.partial) {
        await invalidateCanonicalParentQueries(queryClient, { parentType: "listing", parentId: listing.id, kind: listing._type });
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
          <DialogTitle>Edit listing</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={form.title} onChange={set("title")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-price">Price</Label>
            <Input id="edit-price" type="number" value={form.price} onChange={set("price")} />
          </div>
          <LocationSelector
            level="city"
            value={form.location_id}
            onChange={(value) => setForm((current) => ({ ...current, location_id: value }))}
          />
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea id="edit-desc" rows={4} value={form.description} onChange={set("description")} />
          </div>
          <div className="space-y-3">
            <div>
              <Label>Listing images</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {listing.has_legacy_media
                  ? "Existing legacy images are preserved until their source objects are migrated."
                  : "Keep at least 1 image · JPG, PNG, or WebP · 5 MB each · up to 20."}
              </p>
            </div>
            {!listing.has_legacy_media && (
              <>
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading || saving || media.length >= 20} className="flex min-h-24 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 text-center hover:border-primary/50 disabled:opacity-60">
                  {uploading ? <><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="mt-2 text-sm">Validating and uploading…</span></> : <><Camera className="h-7 w-7 text-muted-foreground" /><span className="mt-2 text-sm font-semibold">Add listing images</span></>}
                </button>
                <input ref={imageInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadImages} />
              </>
            )}
            {media.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {media.map((item, index) => (
                  <div key={item.path} className="relative aspect-square overflow-hidden rounded-xl border">
                    <img src={item.previewUrl} alt={`Listing image ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    {!item.legacy && <Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2 h-11 w-11" onClick={() => removeImage(item)} disabled={saving} aria-label={`Remove listing image ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </div>
            )}
            {mediaError && <p role="alert" className="text-sm text-destructive">{mediaError}</p>}
          </div>
          <TourManagementPanel
            parentType="listing"
            parentId={listing.id}
            category={listing._type}
            onBusyChange={setTourBusy}
          />
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Contact phone</Label>
            <Input id="edit-phone" type="tel" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+263..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-whatsapp">WhatsApp</Label>
            <Input id="edit-whatsapp" type="tel" value={form.contact_whatsapp} onChange={set("contact_whatsapp")} placeholder="+263..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Contact email</Label>
            <Input id="edit-email" type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="you@example.com" />
            <p className="text-[10px] text-muted-foreground">Leave blank to use your account email for one-click email enquiries.</p>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant={canSubmitForReview ? "outline" : "default"}
            className="rounded-xl"
            disabled={saving || uploading || tourBusy}
            onClick={() => save(false)}
          >
            Save changes
          </Button>
          {canSubmitForReview && (
            <Button className="rounded-xl" disabled={saving || uploading || tourBusy} onClick={() => save(true)}>
              {saving ? "Saving…" : "Save and submit for review"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
