import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as authService from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, MailCheck } from "lucide-react";
import PhoneInput from "@/components/ui/PhoneInput";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import AppleIcon from "@/components/AppleIcon";
import { toast } from "@/components/ui/use-toast";
import { hasEnabledOAuthProvider, oauthProviders } from "@/lib/oauthProviders";
import { createLoginPath, sanitizeReturnTo } from "@/lib/authNavigation";

// Phase 2B. Replaces the Base44 register -> custom 6-digit OTP screen flow
// with Supabase's standard signUp -> email confirmation link flow, per the
// decision recorded in docs/AUTH_MIGRATION_PLAN.md §5. There is no OTP input
// anymore -- confirming happens by clicking the link Supabase emails, which
// (via detectSessionInUrl in src/lib/supabaseClient.js) logs the user in
// automatically when they land back on the app.
export default function Register() {
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"), "/");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [oauthProvider, setOauthProvider] = useState("");
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    const normalizedPhone = phone.replace(/[^\d+]/g, "");
    if (!normalizedPhone.startsWith("+") || normalizedPhone.length < 8) {
      setError("Please enter a valid phone number including country code");
      return;
    }
    setLoading(true);
    try {
      const signUpResult = await authService.signUp({ email, password, phone: normalizedPhone, redirectPath: returnTo });
      if (signUpResult.session) {
        window.location.assign(authService.appUrl(returnTo));
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResending(true);
    try {
      await authService.resendSignupConfirmation(email, returnTo);
      toast({
        title: "Email sent",
        description: "Check your inbox for the confirmation link.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend confirmation email");
    } finally {
      setResending(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError("");
    setOauthProvider(provider);
    try {
      await authService.signInWithOAuth(provider, returnTo);
    } catch (err) {
      setError(err.message || `Unable to continue with ${provider}`);
      setOauthProvider("");
    }
  };

  if (sent) {
    return (
      <AuthLayout
        icon={MailCheck}
        title="Check your email"
        subtitle={`We sent a confirmation link to ${email}`}
        footer={
          <Link to={createLoginPath(returnTo)} className="text-primary font-medium hover:underline">
            Back to log in
          </Link>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
            {error}
          </div>
        )}
        <p className="text-sm text-foreground text-center leading-relaxed">
          Click the link in that email to confirm your account. You'll be
          signed in automatically when you come back.
        </p>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't get it?{" "}
          <button type="button" onClick={handleResend} className="text-primary font-medium hover:underline" disabled={resending}>
            {resending ? "Sending..." : "Resend"}
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link to={createLoginPath(returnTo)} className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {oauthProviders.google && (
        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium mb-3"
          onClick={() => handleOAuth("google")}
          disabled={loading || Boolean(oauthProvider)}
        >
          <GoogleIcon className="w-5 h-5 mr-2" />
          {oauthProvider === "google" ? "Connecting to Google..." : "Continue with Google"}
        </Button>
      )}

      {oauthProviders.apple && (
        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium mb-3"
          onClick={() => handleOAuth("apple")}
          disabled={loading || Boolean(oauthProvider)}
        >
          <AppleIcon className="w-5 h-5 mr-2" />
          {oauthProvider === "apple" ? "Connecting to Apple..." : "Continue with Apple"}
        </Button>
      )}

      {hasEnabledOAuthProvider && (
        <div className="relative mb-6 mt-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-3 text-muted-foreground">or</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <PhoneInput id="phone" name="phone" value={phone} onChange={setPhone} placeholder="712 345 678" autoComplete="tel" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              minLength={8}
              aria-describedby="register-password-requirements"
              required
            />
          </div>
          <p id="register-password-requirements" className="text-xs text-muted-foreground">Use at least 8 characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              minLength={8}
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading || Boolean(oauthProvider)}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
