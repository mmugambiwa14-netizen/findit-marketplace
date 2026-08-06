import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, ExternalLink, Pencil } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import BusinessProfileForm from '@/components/business/BusinessProfileForm';
import VerifiedBusinessBadge from '@/components/business/VerifiedBusinessBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { getOwnerBusinessProfile, saveOwnerBusinessProfile } from '@/services/businessProfilesService';

export default function BusinessProfiles() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['owner-business-profile', user?.id],
    queryFn: () => getOwnerBusinessProfile(user.id),
    enabled: Boolean(user?.id),
  });

  const saveMutation = useMutation({
    mutationFn: ({ input, logoChange }) => saveOwnerBusinessProfile(user.id, profileQuery.data?.id, input, logoChange),
    onSuccess: (profile) => {
      queryClient.setQueryData(['owner-business-profile', user.id], profile);
      setEditing(false);
      toast.success('Business profile saved');
    },
    onError: (error) => {
      if (error?.profileSaved) queryClient.invalidateQueries({ queryKey: ['owner-business-profile', user.id] });
    },
  });

  const profile = profileQuery.data;
  const showForm = !profile || editing;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/profile')} aria-label="Back to profile">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Business profile</h1>
            <p className="text-sm text-muted-foreground">Your public business identity and approval status.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {profileQuery.isLoading ? (
          <div className="flex justify-center py-16" aria-label="Loading business profile">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          </div>
        ) : profileQuery.error ? (
          <Card><CardContent className="p-6 text-center">
            <h2 className="font-semibold">We could not load your business profile</h2>
            <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => profileQuery.refetch()}>Try again</Button>
          </CardContent></Card>
        ) : showForm ? (
          <Card>
            <CardHeader>
              <CardTitle>{profile ? 'Edit your profile' : 'Create your profile'}</CardTitle>
              <CardDescription>Approval is controlled by the separate business application review and cannot be edited here.</CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessProfileForm
                key={profile?.updated_at ?? 'new'}
                profile={profile}
                onSubmit={(input, logoChange) => saveMutation.mutate({ input, logoChange })}
                onCancel={() => setEditing(false)}
                isPending={saveMutation.isPending}
                error={saveMutation.error}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex-row items-start gap-4 space-y-0">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={`${profile.company_name} logo`} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Building2 className="h-8 w-8 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="truncate text-xl">{profile.company_name}</CardTitle>
                  <VerifiedBusinessBadge verified={profile.verified} status={profile.verification_status} />
                </div>
                <CardDescription className="mt-1 capitalize">{profile.business_type.replaceAll('_', ' ')}</CardDescription>
                <p className="mt-2 text-xs text-muted-foreground">Public as a {profile.profile_type} profile</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {profile.description && <p className="text-sm leading-relaxed text-muted-foreground">{profile.description}</p>}
              {profile.verification_status === 'pending' && <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm">Your business application is still under review. Publishing access remains category-specific.</p>}
              {profile.verification_status === 'rejected' && <p className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">Approval was not granted. Review your latest notification or application message before applying again.</p>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="sm:flex-1"><Link to={profile.public_path}><ExternalLink className="mr-2 h-4 w-4" />View public profile</Link></Button>
                <Button type="button" variant="outline" className="sm:flex-1" onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />Edit profile</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
