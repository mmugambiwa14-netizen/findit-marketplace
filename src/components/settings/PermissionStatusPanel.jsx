import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const PERMISSIONS = [
  { key: 'camera', browserName: 'camera', label: 'Camera', use: 'Record a Peek' },
  { key: 'microphone', browserName: 'microphone', label: 'Microphone', use: 'Add audio to a Peek' },
  { key: 'location', browserName: 'geolocation', label: 'Location', use: 'Suggest nearby places' },
];

function statusLabel(status) {
  return {
    granted: 'Allowed',
    denied: 'Blocked',
    prompt: 'Ask when needed',
  }[status] || 'Not available';
}

function statusClass(status) {
  if (status === 'granted') return 'text-success';
  if (status === 'denied') return 'text-destructive';
  return 'text-muted-foreground';
}

export default function PermissionStatusPanel() {
  /** @type {[Record<string, string>, (value: Record<string, string>) => void]} */
  const [statuses, setStatuses] = useState({});
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    /** @type {Record<string, string>} */
    const next = {};
    if (typeof Notification !== 'undefined') next.notifications = Notification.permission;
    await Promise.all(PERMISSIONS.map(async ({ key, browserName }) => {
      try {
        if (!navigator.permissions?.query) throw new Error('Permission API unavailable');
        const permission = await navigator.permissions.query({ name: /** @type {PermissionName} */ (browserName) });
        next[key] = permission.state;
      } catch {
        next[key] = 'unavailable';
      }
    }));
    setStatuses(next);
    setChecking(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="locked-icon-tile h-10 w-10 shrink-0"><ShieldCheck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Device permissions</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">PeekaListing asks only when a feature needs access. You can change a blocked permission in your browser or device settings.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="min-h-10 shrink-0" onClick={() => void refresh()} disabled={checking} aria-label="Refresh permission status">
          <RefreshCw className={checking ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>
      {checking && Object.keys(statuses).length === 0 ? <ListRowsSkeleton rows={4} showThumbnail={false} label="Checking device permissions" /> : <div className="divide-y divide-border rounded-xl border border-border" aria-live="polite">
        {PERMISSIONS.map(({ key, label, use }) => (
          <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <div><p className="font-semibold">{label}</p><p className="text-xs text-muted-foreground">{use}</p></div>
            <span className={`shrink-0 text-xs font-bold ${statusClass(statuses[key])}`}>{statusLabel(statuses[key])}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
          <div><p className="font-semibold">Notifications</p><p className="text-xs text-muted-foreground">Alerts outside the app</p></div>
          <span className={`shrink-0 text-xs font-bold ${statusClass(statuses.notifications)}`}>{statusLabel(statuses.notifications)}</span>
        </div>
      </div>}
      {Object.values(statuses).some((status) => status === 'denied') && (
        <p className="text-xs leading-5 text-destructive">A blocked permission cannot be re-enabled from a web page. Open the site permissions control in your browser, allow access, then return and refresh this panel.</p>
      )}
    </div>
  );
}
