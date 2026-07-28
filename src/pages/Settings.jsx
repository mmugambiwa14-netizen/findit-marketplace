import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Eye, EyeOff, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import * as authService from "@/services/authService";
import { PASSWORD_MIN_LENGTH, passwordPolicyError } from "@/lib/passwordPolicy";
import { updateOwnProfile } from "@/services/profileService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import SellerProfileFields from "@/components/settings/SellerProfileFields";

export default function Settings() {
  const navigate = useNavigate();
  const { user, checkUserAuth } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name || "");
  }, [user?.full_name]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateOwnProfile(user.id, { full_name: fullName });
      await checkUserAuth();
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.message || "Unable to update your profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwords.next !== passwords.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    const policyError = passwordPolicyError(passwords.next);
    if (policyError) {
      toast.error(policyError);
      return;
    }
    if (!passwords.current) {
      toast.error("Enter your current password");
      return;
    }

    setSavingPassword(true);
    try {
      await authService.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      setShowPasswordForm(false);
      toast.success("Password updated");
    } catch (error) {
      toast.error(error.message || "Unable to update your password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={() => navigate(-1)} className="p-1" aria-label="Go back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">Settings</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 py-4">
        <Section icon={User} title="Account profile">
          <div className="space-y-3">
            <div>
              <Label htmlFor="settings-name" className="text-xs font-medium">Full name</Label>
              <Input
                id="settings-name"
                className="mt-1 rounded-xl"
                value={fullName}
                maxLength={120}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="settings-email" className="text-xs font-medium">Email</Label>
              <Input id="settings-email" className="mt-1 rounded-xl" value={user?.email || ""} disabled />
              <p className="mt-1 text-[11px] text-muted-foreground">Email changes are not available in Version 1.</p>
            </div>
            <div>
              <Label htmlFor="settings-phone" className="text-xs font-medium">Phone</Label>
              <Input id="settings-phone" className="mt-1 rounded-xl" value={user?.phone || ""} disabled />
              <p className="mt-1 text-[11px] text-muted-foreground">Phone changes require a secure re-verification flow and are temporarily unavailable.</p>
            </div>
            <Button onClick={handleSaveProfile} disabled={savingProfile || !fullName.trim()} size="sm" className="rounded-xl">
              {savingProfile ? "Saving..." : <><Check className="w-3 h-3 mr-1" /> Save profile</>}
            </Button>
          </div>

          <Separator className="my-4" />

          <button
            type="button"
            onClick={() => setShowPasswordForm((visible) => !visible)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {showPasswordForm ? "Cancel password change" : "Change password"}
          </button>

          {showPasswordForm && (
            <div className="mt-3 space-y-3">
              {[
                ["current", "Current password"],
                ["next", "New password"],
                ["confirm", "Confirm new password"],
              ].map(([field, label]) => (
                <div key={field}>
                  <Label htmlFor={`settings-${field}-password`} className="text-xs font-medium">{label}</Label>
                  <div className="relative mt-1">
                    <Input
                      id={`settings-${field}-password`}
                      type={showPasswords[field] ? "text" : "password"}
                      autoComplete={field === "current" ? "current-password" : "new-password"}
                      minLength={field === "current" ? undefined : PASSWORD_MIN_LENGTH}
                      className="rounded-xl pr-10"
                      value={passwords[field]}
                      onChange={(event) => setPasswords((current) => ({ ...current, [field]: event.target.value }))}
                    />
                    <button
                      type="button"
                      aria-label={`${showPasswords[field] ? "Hide" : "Show"} ${label.toLowerCase()}`}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPasswords((current) => ({ ...current, [field]: !current[field] }))}
                    >
                      {showPasswords[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <Button size="sm" className="rounded-xl" disabled={savingPassword} onClick={handlePasswordChange}>
                <Lock className="w-3 h-3 mr-1" />
                {savingPassword ? "Updating..." : "Update password"}
              </Button>
            </div>
          )}
        </Section>

        <Section icon={User} title="Seller profile">
          <SellerProfileFields user={user} onSaved={checkUserAuth} />
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </section>
  );
}
