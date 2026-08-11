import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';
import { getNotificationPreferences, updateNotificationPreferences } from '@/repositories/notificationPreferencesRepository';
import { playNotificationTone, primeNotificationAudio } from '@/services/notificationTone';

const PREFERENCES_KEY = ['notification-preferences'];

export default function NotificationSoundSettings() {
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const query = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: getNotificationPreferences,
    staleTime: 5 * 60_000,
  });
  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => queryClient.setQueryData(PREFERENCES_KEY, data),
    onError: (error) => toast.error(error.message || 'Could not update sound preference'),
  });

  if (query.isLoading) return <ListRowsSkeleton rows={2} showThumbnail={false} label="Loading sound preference" />;
  if (query.error) return <p className="text-sm text-destructive" role="alert">Sound preference is temporarily unavailable.</p>;

  const enabled = query.data?.inAppSoundEnabled !== false;
  const toggle = async () => {
    if (!enabled) await primeNotificationAudio();
    mutation.mutate({ inAppSoundEnabled: !enabled });
  };
  const testTone = async () => {
    setTesting(true);
    const played = await playNotificationTone({ enabled: true });
    setTesting(false);
    if (!played) toast.error('Your browser blocked audio. Tap the page once, then try again.');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="locked-icon-tile h-10 w-10 shrink-0">{enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">In-app notification sound</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Play a short PeekaListing tone for new foreground notifications. Browser and operating-system sounds for background push remain under device control.</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant={enabled ? 'default' : 'outline'} className="rounded-xl" disabled={mutation.isPending} onClick={() => void toggle()}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {enabled ? 'Sound enabled' : 'Sound disabled'}
        </Button>
        <Button type="button" variant="outline" className="rounded-xl" disabled={testing} onClick={() => void testTone()}>
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Play test tone
        </Button>
      </div>
    </div>
  );
}
