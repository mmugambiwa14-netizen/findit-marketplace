import { useEffect, useRef, useState } from "react";
import InfoHint from '@/components/ui/info-hint';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Check, Loader2, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateOwnProfile } from "@/services/profileService";
import {
  attachMarketplaceImage,
  detachMarketplaceImage,
  removeStagedMarketplaceImage,
  uploadMarketplaceImage,
} from "@/services/marketplaceImagesService";

export default function SellerProfileFields({ user, onSaved }) {
  const logoInputRef = useRef(null);
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [publicAddress, setPublicAddress] = useState(user?.public_address || "");
  const [websiteUrl, setWebsiteUrl] = useState(user?.website_url || "");
  const [logoUpload, setLogoUpload] = useState(null);
  const [removeExistingLogo, setRemoveExistingLogo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarUrl = logoUpload?.previewUrl || (!removeExistingLogo ? user?.avatar_url : "");
  const initial = (user?.full_name || user?.email || "?").charAt(0).toUpperCase();

  useEffect(() => {
    setDisplayName(user?.display_name || "");
    setBio(user?.bio || "");
    setPublicAddress(user?.public_address || "");
    setWebsiteUrl(user?.website_url || "");
  }, [user?.bio, user?.display_name, user?.public_address, user?.website_url]);

  const chooseLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    setLogoError("");
    try {
      if (logoUpload?.path) {
        await removeStagedMarketplaceImage(logoUpload.path, "seller_logo");
      }
      setLogoUpload(await uploadMarketplaceImage(file, "seller_logo"));
      setRemoveExistingLogo(false);
    } catch (error) {
      setLogoError(error.message || "The logo could not be uploaded.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    if (logoUpload?.path) {
      await removeStagedMarketplaceImage(logoUpload.path, "seller_logo").catch(() => {});
      setLogoUpload(null);
    }
    setRemoveExistingLogo(Boolean(user?.avatar_storage_path));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const savedProfile = await updateOwnProfile(user.id, {
        display_name: displayName,
        bio,
        public_address: publicAddress,
        website_url: websiteUrl,
      });

      if (logoUpload) {
        try {
          const attached = await attachMarketplaceImage({
            ...logoUpload,
            purpose: "seller_logo",
            targetKind: "seller",
            targetId: user.id,
            displayOrder: 0,
          });
          if (attached.previousPath && attached.previousPath !== attached.path) {
            await removeStagedMarketplaceImage(attached.previousPath, "seller_logo");
          }
        } catch (error) {
          await removeStagedMarketplaceImage(logoUpload.path, "seller_logo").catch(() => {});
          throw Object.assign(
            new Error("Profile details were saved, but the logo could not be attached."),
            { cause: error, profileSaved: true },
          );
        }
      } else if (removeExistingLogo && savedProfile.avatar_storage_path) {
        await detachMarketplaceImage("seller", user.id, savedProfile.avatar_storage_path);
      }

      setLogoUpload(null);
      setRemoveExistingLogo(false);
      setLogoError("");
      await onSaved?.();
      toast.success("Seller profile updated");
    } catch (error) {
      toast.error(error.message || "Unable to update your seller profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border/80 bg-surface-secondary/45 p-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/10">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Seller logo preview" loading="eager" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-primary">{initial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <p className="text-sm font-semibold">Seller logo</p>
            <InfoHint label="Seller logo"><p>Use a clear logo or profile image. JPG, PNG, or WebP up to 5 MB.</p></InfoHint>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={uploadingLogo || saving} onClick={() => logoInputRef.current?.click()}>
              {uploadingLogo ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
              {avatarUrl ? "Replace logo" : "Add logo"}
            </Button>
            {(logoUpload || user?.avatar_storage_path) && (
              <Button type="button" size="sm" variant="ghost" disabled={uploadingLogo || saving} onClick={removeLogo}>
                <Trash2 className="mr-1.5 h-4 w-4" />Remove
              </Button>
            )}
          </div>
          <input ref={logoInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={chooseLogo} />
        </div>
      </div>
      {logoError && <p className="text-sm text-destructive" role="alert">{logoError}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="seller-display-name" className="text-xs font-medium">Public seller or business name</Label>
          <Input
            id="seller-display-name"
            className="mt-1 rounded-xl"
            placeholder="Example: Moyo Properties"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={120}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">This is the name buyers see on your seller profile.</p>
        </div>

        <div>
          <Label htmlFor="seller-website" className="text-xs font-medium">Website (optional)</Label>
          <Input
            id="seller-website"
            type="url"
            className="mt-1 rounded-xl"
            placeholder="https://example.co.zw"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            maxLength={2048}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="seller-address" className="text-xs font-medium">Public address or service area (optional)</Label>
        <div className="relative mt-1">
          <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="seller-address"
            className="rounded-xl pl-9"
            placeholder="Example: 12 Samora Machel Avenue, Harare"
            value={publicAddress}
            onChange={(event) => setPublicAddress(event.target.value)}
            maxLength={300}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Only publish a business or service-area address—not a private home address.</p>
      </div>

      <div>
        <Label htmlFor="seller-bio" className="text-xs font-medium">About</Label>
        <Textarea
          id="seller-bio"
          className="mt-1 h-24 rounded-xl"
          placeholder="Tell buyers what you sell and how you work."
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={500}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">{bio.length}/500</p>
      </div>

      <Button onClick={handleSave} disabled={saving || uploadingLogo} size="sm" className="rounded-xl">
        {saving ? "Saving..." : <><Check className="w-3 h-3 mr-1" /> Save seller profile</>}
      </Button>
    </div>
  );
}
