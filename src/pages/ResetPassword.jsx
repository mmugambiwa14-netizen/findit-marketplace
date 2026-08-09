import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as authService from "@/services/authService";
import { PASSWORD_MIN_LENGTH, passwordPolicyError } from "@/lib/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import { FormSkeleton } from '@/components/loading/LoadingSkeletons';
import AuthLayout from "@/components/AuthLayout";

// Phase 2B. Replaces base44.auth.resetPassword({ resetToken, newPassword }).
//
// Base44 put a resetToken in the URL as a query param and this page read it
// directly. Supabase's reset-password email instead links to this page with
// the recovery token in the URL, which supabaseClient.js's
// `detectSessionInUrl: true` parses automatically into a temporary
// "recovery" session before this component even mounts -- there is no token
// for this page to read manually anymore.
//
// A normal Supabase session is not a password-recovery credential. The
// auth service records only a real PASSWORD_RECOVERY event (including one
// that arrives before this component mounts), then verifies that its user
// matches the current session before it unlocks the form.
export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [recoverySessionClosed, setRecoverySessionClosed] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkRecoverySession = async () => {
      try {
        const hasRecoverySession = await authService.hasPasswordRecoverySession();
        if (!cancelled) {
          setReady(hasRecoverySession);
        }
      } catch {
        if (!cancelled) {
          setReady(false);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    checkRecoverySession();

    const unsubscribe = authService.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        setReady(true);
        setChecking(false);
      } else if (event === "SIGNED_OUT") {
        setReady(false);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await authService.updatePassword(newPassword);
      try {
        await authService.signOut();
        setRecoverySessionClosed(true);
      } catch {
        // The password change has already succeeded. Keep the result truthful
        // and tell the user that this recovery session still needs attention.
        setRecoverySessionClosed(false);
      }
      setDone(true);
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-card">
          <FormSkeleton fields={2} label="Checking password reset link" />
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Invalid reset link"
        subtitle="This password reset link is missing, invalid, or has expired"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          The link you used appears to be incomplete or no longer valid.
          Please request a new password reset email.
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        icon={Lock}
        title="Password updated"
        subtitle="Your password has been changed"
        footer={recoverySessionClosed ? (
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        ) : (
          <Link to="/settings" className="text-primary font-medium hover:underline">
            Open account settings
          </Link>
        )}
      >
        {recoverySessionClosed ? (
          <p className="text-sm text-foreground text-center" role="status">
            The recovery session was closed. You can now log in with your new password.
          </p>
        ) : (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground" role="alert">
            Your password changed, but this browser could not close the recovery session. Sign out from account settings before leaving a shared device.
          </div>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="New password"
      subtitle="Enter your new password below"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              minLength={PASSWORD_MIN_LENGTH}
              aria-describedby="password-requirements"
              required
            />
          </div>
          <p id="password-requirements" className="text-xs text-muted-foreground">Use at least 10 characters with lowercase, uppercase and a number.</p>
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
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
