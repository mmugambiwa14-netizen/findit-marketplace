import { BarChart3, MousePointerClick, View } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const number = (value) => Number(value ?? 0).toLocaleString();
const percent = (value) => `${(Number(value ?? 0) * 100).toFixed(1)}%`;
const serviceLabel = (value) => String(value ?? '')
  .replace(/-service$/, '')
  .replaceAll('-', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminRecommendationAnalytics({ data, isLoading, error }) {
  const summary = data?.summary ?? {};
  const services = data?.services ?? [];

  return (
    <section aria-labelledby="recommendation-analytics-title" className="space-y-4">
      <div>
        <h2 id="recommendation-analytics-title" className="text-xl font-bold">Recommendation performance</h2>
        <p className="text-sm text-muted-foreground">
          Aggregate delivery metrics for the last 30 days. No account or session identities are included.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          Recommendation analytics are unavailable: {error.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={View} title="Impressions" value={isLoading ? '...' : number(summary.impressions)} />
        <MetricCard icon={MousePointerClick} title="Recommendation opens" value={isLoading ? '...' : number(summary.clicks)} />
        <MetricCard icon={BarChart3} title="Open rate" value={isLoading ? '...' : percent(summary.clickThroughRate)} />
      </div>

      <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Service</th>
              <th className="px-4 py-3 text-right font-medium">Impressions</th>
              <th className="px-4 py-3 text-right font-medium">Opens</th>
              <th className="py-3 pl-4 text-right font-medium">Open rate</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && services.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">No recommendation delivery has been aggregated yet.</td>
              </tr>
            ) : services.map((service) => (
              <tr key={service.service} className="border-b last:border-0">
                <td className="py-3 pr-4 font-medium">{serviceLabel(service.service)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{number(service.impressions)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{number(service.clicks)}</td>
                <td className="py-3 pl-4 text-right tabular-nums">{percent(service.clickThroughRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetricCard({ icon: Icon, title, value }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent><p className="text-2xl font-bold tabular-nums">{value}</p></CardContent>
    </Card>
  );
}
