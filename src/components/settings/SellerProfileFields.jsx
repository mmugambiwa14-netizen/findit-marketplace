import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { updateOwnProfile } from "@/services/profileService";

export default function SellerProfileFields({ user, onSaved }) {
  const [bio, setBio] = useState(user?.bio || "");
  const [saving, setSaving] = useState(false);
  const avatarUrl = user?.avatar_url || "";
  const initial = (user?.full_name || user?.email || "?").charAt(0).toUpperCase();

  useEffect(() => {
    setBio(user?.bio || "");
  }, [user?.bio]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOwnProfile(user.id, { bio });
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
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-primary-foreground">{initial}</span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Photo changes will return after secure marketplace media storage is enabled. Existing profile photos remain visible.
        </p>
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

      <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-xl">
        {saving ? "Saving..." : <><Check className="w-3 h-3 mr-1" /> Save seller profile</>}
      </Button>
    </div>
  );
}
