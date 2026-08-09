import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getEmailNotificationPreferences, updateEmailNotificationPreferences } from '@/repositories/emailNotificationRepository';

const OPTIONS = [
  ['messages', 'Messages', 'New conversations and enquiries'],
  ['peekActivity', 'Peek activity', 'Peek requests, answers and video updates'],
  ['listingActivity', 'Listing activity', 'Important changes to your listings'],
  ['moderation', 'Trust and safety', 'Moderation, account and appeal decisions'],
  ['productUpdates', 'Product updates', 'Occasional PeekaListing improvements'],
];

export default function EmailNotificationSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['email-notification-preferences'],
    queryFn: getEmailNotificationPreferences,
    staleTime: 5 * 60_000,
  });
  const mutation = useMutation({
    mutationFn: updateEmailNotificationPreferences,
    onSuccess: (data) => queryClient.setQueryData(['email-notification-preferences'], data),
    onError: (error) => toast.error(error.message || 'Could not update email notifications'),
  });

  const preferences = query.data;
  const toggle = (key) => mutation.mutate({ [key]: !preferences?.[key] });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Essential email alerts</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Important account events use one consistent, professional PeekaListing email template. You can choose which categories arrive by email.</p>
        </div>
      </div>

      {query.isLoading ? <p className="text-sm text-muted-foreground" role="status">Loading email preferences…</p> : query.error ? <p className="text-sm text-destructive" role="alert">Email preferences are temporarily unavailable.</p> : (
        <>
          <ToggleRow label="Email notifications" description="Allow essential account email" checked={preferences?.enabled === true} onChange={() => toggle('enabled')} disabled={mutation.isPending} />
          <div className="space-y-1 rounded-xl border border-border/70 p-2">
            {OPTIONS.map(([key, label, description]) => <ToggleRow key={key} label={label} description={description} checked={preferences?.enabled !== false && preferences?.[key] === true} onChange={() => toggle(key)} disabled={mutation.isPending || preferences?.enabled === false} />)}
          </div>
          <p className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />Security and account-recovery messages may still be sent when required to protect your account.</p>
        </>
      )}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
      <input type="checkbox" className="h-4 w-4 accent-primary" checked={Boolean(checked)} onChange={onChange} disabled={disabled} />
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span>
    </label>
  );
}
