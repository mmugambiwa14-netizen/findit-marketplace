import { Activity, AlertTriangle, CheckCircle2, Database, Gauge, HardDrive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminCardsSkeleton, ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

function number(value) {
  return Number(value ?? 0).toLocaleString();
}

function bytes(value) {
  const total = Number(value ?? 0);
  if (!Number.isFinite(total) || total <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(total) / Math.log(1024)), units.length - 1);
  return `${(total / (1024 ** unit)).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function duration(value) {
  const total = Number(value ?? 0);
  if (!Number.isFinite(total)) return '—';
  return total >= 1000 ? `${(total / 1000).toFixed(2)} s` : `${Math.round(total)} ms`;
}

export default function AdminOperationalHealth({ data, isLoading, error }) {
  const alerts = data?.openAlerts || [];
  const queues = data?.queues || {};
  const storage = data?.storage || {};
  const metrics = data?.metrics || {};
  const feedLatency = metrics.feed_latency_ms?.maximum ?? 0;
  const messageLatency = metrics.message_send_latency_ms?.maximum ?? 0;

  if (isLoading) {
    return (
      <section aria-labelledby="operational-health-title" className="space-y-4">
        <div><h2 id="operational-health-title" className="text-xl font-bold">Operational health</h2><p className="text-sm text-muted-foreground">Loading server health and release alerts.</p></div>
        <AdminCardsSkeleton label="Loading operational health" />
        <div className="grid gap-4 md:grid-cols-2"><Card className="p-4"><ListRowsSkeleton rows={5} showThumbnail={false} label="Loading worker queues" /></Card><Card className="p-4"><ListRowsSkeleton rows={4} showThumbnail={false} label="Loading retained media" /></Card></div>
      </section>
    );
  }

  return (
    <section aria-labelledby="operational-health-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="operational-health-title" className="text-xl font-bold">Operational health</h2>
          <p className="text-sm text-muted-foreground">Compact server metrics and deterministic release alerts from the last {data?.windowHours || 24} hours.</p>
        </div>
        {alerts.length ? <Badge variant="destructive">{alerts.length} open alert{alerts.length === 1 ? '' : 's'}</Badge> : <Badge variant="outline" className="border-emerald-500/40 text-emerald-500"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Healthy</Badge>}
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Operational health is unavailable: {error.message}</p>}

      {alerts.length > 0 && (
        <div className="space-y-2" aria-label="Open operational alerts">
          {alerts.map((alert) => (
            <div key={alert.key} className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div><p className="text-sm font-semibold">{String(alert.key).replaceAll('_', ' ')}</p><p className="text-xs text-muted-foreground">Observed {number(alert.observed)} · threshold {number(alert.threshold)}</p></div></div>
              <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>{alert.severity}</Badge>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard icon={Gauge} title="Feed max latency" value={duration(feedLatency)} detail={`${number(metrics.feed_latency_ms?.samples)} weighted samples`} />
        <HealthCard icon={Activity} title="Message max latency" value={duration(messageLatency)} detail={`${number(metrics.message_send_latency_ms?.samples)} sends`} />
        <HealthCard icon={Database} title="Pending work" value={number((queues.processing_due || 0) + (queues.cleanup_pending || 0) + (queues.cache_pending || 0) + (queues.notification_fanout_pending || 0) + (queues.notification_fanout_claimed || 0))} detail={`${number(queues.processing_failed)} processing failures`} />
        <HealthCard icon={HardDrive} title="Tour storage" value={bytes((storage.source_bytes_retained || 0) + (storage.playback_bytes_retained || 0))} detail={`${number(storage.ready_public)} public Tours`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Worker queues</CardTitle>{data?.queueSnapshotAt && <p className="text-xs text-muted-foreground">Hourly snapshot {new Date(data.queueSnapshotAt).toLocaleString()}</p>}</CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Metric label="Processing due" value={queues.processing_due} />
            <Metric label="Processing failed" value={queues.processing_failed} danger={queues.processing_failed > 0} />
            <Metric label="Cleanup pending" value={queues.cleanup_pending} />
            <Metric label="Cleanup dead-lettered" value={queues.cleanup_dead_lettered} danger={queues.cleanup_dead_lettered > 0} />
            <Metric label="Cache pending" value={queues.cache_pending} />
            <Metric label="Cache dead-lettered" value={queues.cache_dead_lettered} danger={queues.cache_dead_lettered > 0} />
            <Metric label="Notification fan-out pending" value={(queues.notification_fanout_pending || 0) + (queues.notification_fanout_claimed || 0)} />
            <Metric label="Notification fan-out stale claims" value={queues.notification_fanout_stale_claims} danger={queues.notification_fanout_stale_claims > 0} />
            <Metric label="Notification fan-out dead-lettered" value={queues.notification_fanout_dead_lettered} danger={queues.notification_fanout_dead_lettered > 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Retained media</CardTitle>{data?.storageSnapshotAt && <p className="text-xs text-muted-foreground">Hourly snapshot {new Date(data.storageSnapshotAt).toLocaleString()}</p>}</CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Metric label="Tour records" value={storage.tour_rows} />
            <Metric label="Ready and public" value={storage.ready_public} />
            <Metric label="Private sources" value={bytes(storage.source_bytes_retained)} text />
            <Metric label="Playback outputs" value={bytes(storage.playback_bytes_retained)} text />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function HealthCard({ icon: Icon, title, value, detail }) {
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function Metric({ label, value, danger = false, text = false }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={danger ? 'font-semibold text-destructive' : 'font-semibold'}>{text ? value : number(value)}</p></div>;
}
