import { useState } from 'react';
import { Button } from '@/components/ui/button';
import GoogleIcon from '@/components/GoogleIcon';
import { oauthProviders } from '@/lib/oauthProviders';
import * as authService from '@/services/authService';
import { cn } from '@/lib/utils';

/**
 * @param {{
 *   className?: string,
 *   label?: string,
 *   redirectTo?: string,
 *   variant?: "default" | "outline"
 * }} props
 */
export default function GoogleAuthButton({
  className = '',
  label = 'Continue with Google',
  redirectTo = '/',
  variant = 'outline',
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!oauthProviders.google) return null;

  const continueWithGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await authService.signInWithOAuth('google', redirectTo);
    } catch (failure) {
      setError(failure.message || 'Google sign-in is temporarily unavailable.');
      setLoading(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        type="button"
        variant={variant}
        className="h-12 w-full justify-center rounded-xl bg-card/80 font-semibold text-card-foreground shadow-sm"
        onClick={continueWithGoogle}
        disabled={loading}
      >
        <GoogleIcon className="mr-2 h-5 w-5" />
        {loading ? 'Connecting to Google…' : label}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
