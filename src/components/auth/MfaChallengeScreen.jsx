import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { userFacingError } from '@/lib/userFacingErrors';
import * as authService from '@/services/authService';

const CODE_LENGTH = 6;

/**
 * Full-screen step-up shown by AuthenticatedApp when the signed-in user holds a
 * verified TOTP factor but this session is still at aal1. It replaces the whole
 * app until the code is accepted, so the challenge cannot be skipped by
 * navigating elsewhere. `onVerified` re-checks the assurance level, which then
 * lets the real routes render.
 */
export default function MfaChallengeScreen({ onVerified }) {
  const { logout } = useAuth();
  const [factorId, setFactorId] = useState('');
  const [loadingFactor, setLoadingFactor] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let active = true;
    authService.listVerifiedTotpFactors()
      .then((factors) => {
        if (!active) return;
        if (factors.length === 0) {
          // The gate only fires when a verified factor exists, so an empty list
          // means the factor list and the assurance level disagree. Fail safe:
          // do not silently pass the user through.
          setLoadError('We could not find your authenticator. Sign out and sign in again.');
        } else {
          setFactorId(factors[0].id);
        }
        setLoadingFactor(false);
      })
      .catch((failure) => {
        if (!active) return;
        setLoadError(userFacingError(failure, 'We could not start two-step verification. Try again.'));
        setLoadingFactor(false);
      });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (verifying) return;
    setError('');
    setVerifying(true);
    try {
      await authService.verifyTotpCode(factorId, code.trim());
      onVerified();
    } catch (failure) {
      setError(userFacingError(failure, 'That code did not work. Check your authenticator and try again.'));
      setCode('');
      setVerifying(false);
    }
  };

  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Two-step verification"
      subtitle="Enter the 6-digit code from your authenticator app to continue."
      footer={
        <button type="button" onClick={() => logout()} className="font-medium text-primary hover:underline">
          Sign out instead
        </button>
      }
    >
      {loadError ? (
        <div className="space-y-4 text-center">
          <p className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{loadError}</p>
          <Button type="button" variant="outline" className="h-12 w-full" onClick={() => logout()}>Sign out</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Authentication code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className="h-12 text-center text-lg tracking-[0.5em]"
              aria-describedby="mfa-code-help"
              required
            />
            <p id="mfa-code-help" className="text-xs text-muted-foreground">
              Open the authenticator app you used when you turned on two-step verification.
            </p>
          </div>
          <Button type="submit" className="h-12 w-full" disabled={loadingFactor || verifying || code.length < CODE_LENGTH}>
            {verifying ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : 'Verify'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
