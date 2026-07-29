import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  clearRecommendationPersonalizationData,
  getRecommendationPersonalizationPreference,
  setRecommendationPersonalizationPreference,
} from '@/services/recommendationPersonalizationService';

export const recommendationPersonalizationQueryKey = (userId) => [
  'recommendation-personalization',
  userId,
];

export default function PersonalizationSettings({ userId }) {
  const queryClient = useQueryClient();
  const queryKey = recommendationPersonalizationQueryKey(userId);
  const preference = useQuery({
    queryKey,
    queryFn: getRecommendationPersonalizationPreference,
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const updatePreference = useMutation({
    mutationFn: setRecommendationPersonalizationPreference,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({ queryKey: ['listing-recommendations'] });
      toast.success(data.enabled ? 'Personalized recommendations enabled' : 'Personalized recommendations disabled');
    },
    onError: (error) => toast.error(error.message || 'Unable to update recommendation privacy settings'),
  });

  const clearActivity = useMutation({
    mutationFn: clearRecommendationPersonalizationData,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, (current) => ({
        ...(current && typeof current === 'object' ? current : {}),
        enabled: false,
        disabledAt: new Date().toISOString(),
      }));
      queryClient.invalidateQueries({ queryKey: ['listing-recommendations'] });
      toast.success(data.removedEvents > 0 ? 'Recommendation activity cleared' : 'No recommendation activity was stored');
    },
    onError: (error) => toast.error(error.message || 'Unable to clear recommendation activity'),
  });

  const busy = preference.isLoading || updatePreference.isPending || clearActivity.isPending;
  const enabled = preference.data?.enabled === true;

  return (
    <div className="space-y-4">
      <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-border p-3">
        <div>
          <label htmlFor="personalized-recommendations" className="text-sm font-semibold">
            Personalized recommendations
          </label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Use your recent listing activity to rank suggestions. This is off by default.
          </p>
        </div>
        <Switch
          id="personalized-recommendations"
          checked={enabled}
          disabled={busy || preference.isError}
          onCheckedChange={(checked) => updatePreference.mutate(checked)}
          aria-label="Personalized recommendations"
        />
      </div>

      {preference.isError && (
        <div className="flex items-center justify-between gap-3 text-sm" role="alert">
          <span className="text-muted-foreground">Privacy settings could not be loaded.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => preference.refetch()}>
            Try again
          </Button>
        </div>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={busy}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Clear recommendation activity
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear recommendation activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes account-linked recommendation activity and turns personalization off. It does not delete listings, saved items, or messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearActivity.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearActivity.isPending}
              onClick={() => clearActivity.mutate()}
            >
              {clearActivity.isPending ? 'Clearing...' : 'Clear activity'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
