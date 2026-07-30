import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter as Router,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { Toaster as SonnerToaster } from 'sonner';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { CurrencyProvider } from '@/lib/CurrencyContext';
import { createLoginPath } from '@/lib/authNavigation';
import { featureFlags } from '@/lib/featureFlags';
import { queryClientInstance } from '@/lib/query-client';
import AccountBlocked from '@/components/auth/AccountBlocked';
import ProtectedRoute from '@/components/ProtectedRoute';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AdminLayout from '@/components/layout/AdminLayout';
import AppLayout from '@/components/layout/AppLayout';

const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Home = lazy(() => import('@/pages/Home'));
const Search = lazy(() => import('@/pages/Search'));
const CreateListing = lazy(() => import('@/pages/CreateListing'));
const Saved = lazy(() => import('@/pages/Saved'));
const Profile = lazy(() => import('@/pages/Profile'));
const PropertyDetail = lazy(() => import('@/pages/PropertyDetail'));
const CarDetail = lazy(() => import('@/pages/CarDetail'));
const MyListings = lazy(() => import('@/pages/MyListings'));
const Inquiries = lazy(() => import('@/pages/Inquiries'));
const MachineryDetail = lazy(() => import('@/pages/MachineryDetail'));
const Settings = lazy(() => import('@/pages/Settings'));
const BusinessProfiles = lazy(() => import('@/pages/BusinessProfiles'));
const PublicBusinessProfile = lazy(() => import('@/pages/PublicBusinessProfile'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminListings = lazy(() => import('@/pages/admin/AdminListings'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));
const AdminAuditLog = lazy(() => import('@/pages/admin/AdminAuditLog'));
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'));
const NotificationCenter = lazy(() => import('@/pages/NotificationCenter'));
const SellerProfile = lazy(() => import('@/pages/SellerProfile'));
const FAQs = lazy(() => import('@/pages/FAQs'));
const ContactSupport = lazy(() => import('@/pages/ContactSupport'));
const LegalPage = lazy(() => import('@/pages/LegalPage'));
const Services = lazy(() => import('@/pages/Services'));
const ServiceDetail = lazy(() => import('@/pages/ServiceDetail'));
const CreateService = lazy(() => import('@/pages/CreateService'));
const MyServices = lazy(() => import('@/pages/MyServices'));
const Tours = lazy(() => import('@/pages/Tours'));
const ToursPlaceholder = lazy(() => import('@/pages/ToursPlaceholder'));
const PageNotFound = lazy(() => import('@/lib/PageNotFound'));

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background" role="status" aria-label="Loading FindIt">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
  </div>
);

const AuthUnavailable = ({ message, onRetry, onSignOut }) => (
  <main className="fixed inset-0 flex flex-col items-center justify-center bg-background px-4">
    <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card" aria-live="polite">
      <h1 className="text-xl font-semibold">We could not verify your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" onClick={onRetry}>
          Try again
        </button>
        <button type="button" className="inline-flex h-11 items-center justify-center rounded-xl border border-border-strong bg-card px-4 text-sm font-semibold" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </section>
    <nav className="mt-5 flex gap-4 text-xs text-muted-foreground" aria-label="Legal">
      <Link to="/legal/privacy" className="hover:underline">Privacy</Link>
      <Link to="/legal/data-protection" className="hover:underline">Data protection</Link>
      <Link to="/legal/terms" className="hover:underline">Terms</Link>
    </nav>
  </main>
);

function SignInRedirect() {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={createLoginPath(returnTo)} replace state={{ returnTo }} />;
}

function LegacyPathRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

function LegacyConversationRedirect() {
  const { conversationId = '' } = useParams();
  const location = useLocation();
  return <Navigate to={`/chats/${encodeURIComponent(conversationId)}${location.search}${location.hash}`} replace />;
}

function ThemeAwareSonner() {
  const readTheme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <SonnerToaster position="top-center" richColors theme={theme} />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, blockedAccount, checkUserAuth, logout } = useAuth();
  if (isLoadingPublicSettings || isLoadingAuth) return <LoadingScreen />;

  if (blockedAccount) {
    return <AccountBlocked status={blockedAccount.status} reason={blockedAccount.reason} banUntil={blockedAccount.banUntil} />;
  }

  if (authError) {
    if (authError.type === 'profile_missing') return <UserNotRegisteredError onRetry={checkUserAuth} onSignOut={logout} />;
    return <AuthUnavailable message={authError.message} onRetry={checkUserAuth} onSignOut={logout} />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/car/:id" element={<CarDetail />} />
          <Route path="/machinery/:id" element={<MachineryDetail />} />
          <Route path="/seller/:email" element={<SellerProfile />} />
          {featureFlags.businessProfiles && <Route path="/business/:id" element={<PublicBusinessProfile />} />}
          {featureFlags.businessProfiles && <Route path="/dealer/:id" element={<PublicBusinessProfile />} />}
          <Route path="/services" element={<Services />} />
          <Route path="/service/:id" element={<ServiceDetail />} />
          {(featureFlags.tours || featureFlags.toursPreview) && (
            <Route path="/peek" element={featureFlags.tours ? <Tours /> : <ToursPlaceholder />} />
          )}
          {(featureFlags.tours || featureFlags.toursPreview) && <Route path="/tours" element={<LegacyPathRedirect to="/peek" />} />}
          <Route path="/help" element={<FAQs />} />
          <Route path="/help/contact" element={<ContactSupport />} />
          <Route path="/legal/:document" element={<LegalPage />} />
          <Route path="/faqs" element={<Navigate to="/help" replace />} />
          <Route path="/support" element={<Navigate to="/help" replace />} />
          <Route path="/create" element={<LegacyPathRedirect to="/post" />} />
          {featureFlags.messaging && <Route path="/messages" element={<LegacyPathRedirect to="/chats" />} />}
          {featureFlags.messaging && <Route path="/messages/:conversationId" element={<LegacyConversationRedirect />} />}
        </Route>

        <Route element={<ProtectedRoute unauthenticatedElement={<SignInRedirect />} />}>
          <Route element={<AppLayout />}>
            <Route path="/post" element={<CreateListing />} />
            <Route path="/create-service" element={<CreateService />} />
            <Route path="/my-services" element={<MyServices />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/my-listings" element={<MyListings />} />
            <Route path="/settings" element={<Settings />} />
            {featureFlags.messaging && <Route path="/chats" element={<Inquiries />} />}
            {featureFlags.messaging && <Route path="/chats/:conversationId" element={<Inquiries />} />}
            {featureFlags.businessProfiles && <Route path="/business-profiles" element={<BusinessProfiles />} />}
            {featureFlags.essentialNotifications && <Route path="/notifications" element={<NotificationCenter />} />}
          </Route>
        </Route>

        <Route element={<ProtectedRoute unauthenticatedElement={<SignInRedirect />} requiredRole="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/listings" element={<AdminListings />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/audit-log" element={<AdminAuditLog />} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  const routerBaseName = import.meta.env.BASE_URL === '/'
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <AuthProvider>
      <CurrencyProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router basename={routerBaseName}>
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <ThemeAwareSonner />
        </QueryClientProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}

export default App;
