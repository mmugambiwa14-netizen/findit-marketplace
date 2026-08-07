import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, X } from 'lucide-react';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createLoginPath, createRegisterPath, sanitizeReturnTo } from '@/lib/authNavigation';

export function GuestPromptSheet({ open, onClose, action = 'save favourites or post a listing', returnTo = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const safeReturnTo = sanitizeReturnTo(returnTo || currentPath);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="safe-area-bottom gap-0 rounded-3xl p-5 pb-7 sm:max-w-[410px]" onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader className="pr-10 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">PeekaListing account</p>
          <DialogTitle className="mt-1 text-xl">Sign in to continue</DialogTitle>
          <DialogDescription className="pt-2 text-sm leading-6">
            Use a free account to <span className="font-medium text-foreground">{action}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 space-y-2.5">
          <GoogleAuthButton redirectTo={safeReturnTo} />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              onClose();
              navigate(createLoginPath(safeReturnTo), { state: { returnTo: safeReturnTo } });
            }}
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Continue with email
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          New to PeekaListing?{' '}
          <button
            type="button"
            className="font-semibold text-primary hover:text-primary-hover hover:underline"
            onClick={() => {
              onClose();
              navigate(createRegisterPath(safeReturnTo), { state: { returnTo: safeReturnTo } });
            }}
          >
            Create an account
          </button>
        </p>
        <p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">
          By continuing, you agree to the <Link className="underline" to="/legal/terms" onClick={onClose}>Terms</Link> and acknowledge the <Link className="underline" to="/legal/privacy" onClick={onClose}>Privacy Policy</Link>.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function GuestBanner({ user }) {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (user || dismissed) return null;

  const returnTo = sanitizeReturnTo(`${location.pathname}${location.search}${location.hash}`);

  return (
    <div className="fixed bottom-[4.75rem] left-3 right-3 z-[900] md:bottom-5 md:left-auto md:right-5 md:w-auto md:max-w-xs">
      <div className="flex items-center gap-1.5 rounded-full border border-border-strong bg-card/95 py-1.5 pl-3 pr-1.5 text-card-foreground shadow-floating backdrop-blur-xl">
        <p className="flex-1 whitespace-nowrap text-xs font-medium">Save and post for free.</p>
        <Button type="button" size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs" onClick={() => navigate(createRegisterPath(returnTo), { state: { returnTo } })}>
          Join
        </Button>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss account prompt" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-raised">
          <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
