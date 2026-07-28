import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Loader2, Lock, LogIn, Mail } from 'lucide-react';
import AppleIcon from '@/components/AppleIcon';
import AuthLayout from '@/components/AuthLayout';
import GoogleIcon from '@/components/GoogleIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createRegisterPath, sanitizeReturnTo } from '@/lib/authNavigation';
import { hasEnabledOAuthProvider, oauthProviders } from '@/lib/oauthProviders';
import * as authService from '@/services/authService';

export default function Login() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(location.state?.returnTo || searchParams.get('returnTo'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.signInWithPassword(email, password);
      const user = await authService.getCurrentUser();
      const destination = returnTo !== '/' ? returnTo : (user?.role === 'admin' ? '/admin' : '/');
      window.location.assign(authService.appUrl(destination));
    } catch (failure) {
      setError(failure.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError('');
    setOauthProvider(provider);
    try {
      await authService.signInWithOAuth(provider, returnTo);
    } catch (failure) {
      setError(failure.message || `Unable to continue with ${provider}`);
      setOauthProvider('');
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to={createRegisterPath(returnTo)} state={{ returnTo }} className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {oauthProviders.google && (
        <Button variant="outline" className="mb-3 h-12 w-full text-sm font-medium" onClick={() => handleOAuth('google')} disabled={loading || Boolean(oauthProvider)}>
          <GoogleIcon className="h-5 w-5" />
          {oauthProvider === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
        </Button>
      )}

      {oauthProviders.apple && (
        <Button variant="outline" className="mb-3 h-12 w-full text-sm font-medium" onClick={() => handleOAuth('apple')} disabled={loading || Boolean(oauthProvider)}>
          <AppleIcon className="h-5 w-5" />
          {oauthProvider === 'apple' ? 'Connecting to Apple...' : 'Continue with Apple'}
        </Button>
      )}

      {hasEnabledOAuthProvider && (
        <div className="relative mb-6 mt-3">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">or</span></div>
        </div>
      )}

      {error && <div className="mb-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="password" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <Button type="submit" className="h-12 w-full" disabled={loading || Boolean(oauthProvider)}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Logging in...</> : 'Log in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
