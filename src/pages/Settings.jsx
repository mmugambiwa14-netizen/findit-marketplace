import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BellRing, Check, Eye, EyeOff, Lock, ShieldCheck, Trash2, User } from "lucide-react";
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
import PersonalizationSettings from "@/components/settings/PersonalizationSettings";
import PushNotificationSettings from "@/components/settings/PushNotificationSettings";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";

export default function Settings() {
  const navigate = useNavigate();
  const { user, checkUserAuth } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => { setFullName(user?.full_name || ""); }, [user?.full_name]);

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
    if (passwords.next !== passwords.confirm) return toast.error("Passwords do not match");
    const policyError = passwordPolicyError(passwords.next);
    if (policyError) return toast.error(policyError);
    if (!passwords.current) return toast.error("Enter your current password");

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
    <div className="min-h-[100dvh]">
      <div className="locked-page-header flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => navigate(-1)} className="clay-icon h-10 w-10" aria-label="Go back"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 py-4">
        <Section icon={BellRing} title="Push notifications"><PushNotificationSettings /></Section>

        <Section icon={User} title="Account profile">
          <div className="space-y-3">
            <div><Label htmlFor="settings-name" className="text-xs font-medium">Full name</Label><Input id="settings-name" className="mt-1 rounded-xl" value={fullName} maxLength={120} onChange={(event) => setFullName(event.target.value)} /></div>
            <div><Label htmlFor="settings-email" className="text-xs font-medium">Email</Label><Input id="settings-email" className="mt-1 rounded-xl" value={user?.email || ""} disabled /><p className="mt-1 text-[11px] text-muted-foreground">Email changes are not available in Version 1.</p></div>
            <div><Label htmlFor="settings-phone" className="text-xs font-medium">Phone</Label><Input id="settings-phone" className="mt-1 rounded-xl" value={user?.phone || ""} disabled /><p className="mt-1 text-[11px] text-muted-foreground">Phone changes require secure re-verification and are temporarily unavailable.</p></div>
            <Button onClick={handleSaveProfile} disabled={savingProfile || !fullName.trim()} size="sm" className="rounded-xl">{savingProfile ? "Saving..." : <><Check className="mr-1 h-3 w-3" />Save profile</>}</Button>
          </div>

          <Separator className="my-4" />
          <button type="button" onClick={() => setShowPasswordForm((visible) => !visible)} className="text-sm font-medium text-primary hover:underline">{showPasswordForm ? "Cancel password change" : "Change password"}</button>

          {showPasswordForm && (
            <div className="mt-3 space-y-3">
              {[["current", "Current password"], ["next", "New password"], ["confirm", "Confirm new password"]].map(([field, label]) => (
                <div key={field}>
                  <Label htmlFor={`settings-${field}-password`} className="text-xs font-medium">{label}</Label>
                  <div className="relative mt-1">
                    <Input id={`settings-${field}-password`} type={showPasswords[field] ? "text" : "password"} autoComplete={field === "current" ? "current-password" : "new-password"} minLength={field === "current" ? undefined : PASSWORD_MIN_LENGTH} className="rounded-xl pr-10" value={passwords[field]} onChange={(event) => setPasswords((current) => ({ ...current, [field]: event.target.value }))} />
                    <button type="button" aria-label={`${showPasswords[field] ? "Hide" : "Show"} ${label.toLowerCase()}`} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPasswords((current) => ({ ...current, [field]: !current[field] }))}>{showPasswords[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                </div>
              ))}
              <Button size="sm" className="rounded-xl" disabled={savingPassword} onClick={handlePasswordChange}><Lock className="mr-1 h-3 w-3" />{savingPassword ? "Updating..." : "Update password"}</Button>
            </div>
          )}
        </Section>

        <Section icon={User} title="Seller profile"><SellerProfileFields user={user} onSaved={checkUserAuth} /></Section>
        <Section icon={ShieldCheck} title="Recommendation privacy"><PersonalizationSettings userId={user?.id} /></Section>
        <Section icon={Trash2} title="Delete account"><DeleteAccountSection user={user} /></Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return <section className="clay-card rounded-2xl p-4"><div className="mb-4 flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">{title}</h2></div>{children}</section>;
}
