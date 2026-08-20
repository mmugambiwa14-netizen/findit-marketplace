import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAdminRecommendationConfiguration, purgeAdminRecommendationServiceCache } from '@/services/adminService';

const SERVICE_NAMES = [
  ['similar_listings_service', 'Similar listings'],
  ['seller_recommendations_service', 'Seller recommendations'],
  ['related_services_service', 'Related services'],
  ['related_products_service', 'Related products'],
  ['nearby_service', 'Nearby listings'],
  ['recently_listed_service', 'Recently listed'],
  ['personalized_recommendation_service', 'Personalised recommendations'],
];

export default function AdminRecommendationConfiguration() {
  const [serviceName, setServiceName] = useState(SERVICE_NAMES[0][0]);
  const queryClient = useQueryClient();
  const configuration = useQuery({
    queryKey: ['admin-recommendation-configuration'],
    queryFn: getAdminRecommendationConfiguration,
    staleTime: 60_000,
  });
  const purge = useMutation({
    mutationFn: () => purgeAdminRecommendationServiceCache(serviceName),
    onSuccess: (deleted) => {
      queryClient.invalidateQueries({ queryKey: ['admin-recommendation-analytics'] });
      toast.success(`${Number(deleted || 0).toLocaleString()} cached recommendation result(s) cleared`);
    },
    onError: (error) => toast.error(error.message || 'Could not clear recommendation cache'),
  });
  const counts = useMemo(() => ({
    taxonomy: Array.isArray(configuration.data?.taxonomy_nodes) ? configuration.data.taxonomy_nodes.length : 0,
    relationships: Array.isArray(configuration.data?.relationships) ? configuration.data.relationships.length : 0,
    weights: Array.isArray(configuration.data?.weight_profiles) ? configuration.data.weight_profiles.length : 0,
  }), [configuration.data]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4 text-primary" />Recommendation controls</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Read the active ranking vocabulary and clear a bounded cache when configuration changes need to take effect.</p>
        </div>
        {configuration.isFetching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing recommendation configuration" />}
      </CardHeader>
      <CardContent className="space-y-4">
        {configuration.error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{configuration.error.message}</p>}
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="Taxonomy nodes" value={counts.taxonomy} />
          <Metric label="Relationships" value={counts.relationships} />
          <Metric label="Weight profiles" value={counts.weights} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1"><label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="recommendation-cache-service">Cache service</label><Select value={serviceName} onValueChange={setServiceName}><SelectTrigger id="recommendation-cache-service"><SelectValue /></SelectTrigger><SelectContent>{SERVICE_NAMES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <Button type="button" variant="outline" disabled={purge.isPending} onClick={() => purge.mutate()}><RefreshCw className="mr-2 h-4 w-4" />{purge.isPending ? 'Clearing…' : 'Clear service cache'}</Button>
        </div>
        <p className="text-xs text-muted-foreground">Every cache purge is bounded and recorded in the recommendation configuration audit trail.</p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-xl font-bold">{value.toLocaleString()}</p><p className="mt-1 text-[11px] text-muted-foreground">{label}</p></div>;
}
