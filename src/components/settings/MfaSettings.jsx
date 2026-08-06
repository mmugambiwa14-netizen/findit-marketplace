import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userFacingError } from '@/lib/userFacingErrors';
import * as authService from '@/services/authService';

const CODE_LENGTH = 6;

function qrImageSrc(qrCode) {
  if (!qrCode) return '';
  if (qrCode.startsWith('data:')) return qrCode;
  return `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`;
}

export default function MfaSettings() {
  const [status, setStatus] = useState('loading');
  const [factors, setFactors] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  const refresh = async () => {
    const verified = await authService.listVerifiedTotpFactors();
    setFactors(verified);
    return verified;
  };

  useEffect(() => {
    let active = true;
    authService.listVerifiedTotpFactors()
      .then((verified) => { if (active) { setFactors(verified); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('ready'); });
    return () => { active = false; };
  }, []);

  const beginEnrollment = async () => {
    setBusy(true);
    try {
      const started = await authService.enrollTotpFactor('PeekaListing authenticator');
      setEnrollment(started);
      setCode('');
    } catch (error) {
      toast.error(userFacingError(error, 'Two-step verification is not available right now.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrollment = async () => {
    if (!enrollment) return;
    setBusy(true);
    try {
      await authService.verifyTotpCode(enrollment.factorId, code.trim());
      await refresh();
      setEnrollment(null);
      setCode('');
      toast.success('Two-step verification is on');
    } catch (error) {
      toast.error(userFacingError(error, 'That code did not work. Check your authenticator and try again.'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const cancelEnrollment = async () => {
    const pending = enrollment;
    setEnrollment(null);
    setCode('');
    if (pending?.factorId) await authService.unenrollMfaFactor(pending.factorId).catch(() => {});
  };

  const removeFactor = async () => {
    setBusy(true);
    try {
      for (const factor of factors) await authService.unenrollMfaFactor(factor.id);
      await refresh();
      setConfirmingRemoval(false);
      toast.success('Two-step verification is off');
    } catch (error) {
      toast.error(userFacingError(error, 'Unable to turn off two-step verification.'));
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') return <p className="text-sm text-muted-foreground">Loading two-step verification...</p>;

  const isOn = factors.length > 0;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="locked-icon-tile h-10 w-10 shrink-0">{isOn ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{isOn ? 'Two-step verification is on' : 'Add two-step verification'}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isOn ? 'You enter a code from your authenticator app each time you sign in on a new session.' : 'Protect your account with an authenticator app in addition to your password.'}
          </p>
        </div>
      </div>

      {isOn && !confirmingRemoval && <Button type="button" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setConfirmingRemoval(true)}>Turn off two-step verification</Button>}
      {isOn && confirmingRemoval && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-xs leading-5">
          <p className="mb-2">Turning this off leaves your account protected by your password only. Continue?</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="destructive" className="rounded-xl" disabled={busy} onClick={removeFactor}>{busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}Turn off</Button>
            <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setConfirmingRemoval(false)}>Keep it on</Button>
          </div>
        </div>
      )}

      {!isOn && !enrollment && <Button type="button" className="rounded-xl" disabled={busy} onClick={beginEnrollment}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Set up two-step verification</Button>}
      {!isOn && enrollment && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs leading-5 text-muted-foreground">Scan this QR code in your authenticator app, or enter the key manually, then type the 6-digit code it shows.</p>
          {enrollment.qrCode && <img src={qrImageSrc(enrollment.qrCode)} alt="Two-step verification QR code" loading="lazy" decoding="async" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />}
          {enrollment.secret && <div><Label htmlFor="mfa-secret" className="text-xs font-medium">Setup key</Label><Input id="mfa-secret" readOnly value={enrollment.secret} className="mt-1 rounded-xl font-mono text-xs" onFocus={(event) => event.target.select()} /></div>}
          <div>
            <Label htmlFor="mfa-enroll-code" className="text-xs font-medium">Code from your app</Label>
            <Input id="mfa-enroll-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={CODE_LENGTH} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="mt-1 rounded-xl text-center tracking-[0.4em]" />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="rounded-xl" disabled={busy || code.length < CODE_LENGTH} onClick={confirmEnrollment}>{busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}Confirm</Button>
            <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={cancelEnrollment}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
