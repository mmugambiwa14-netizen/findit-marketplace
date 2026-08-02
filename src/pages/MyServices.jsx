import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Briefcase, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/layout/BackButton";
import ManageServiceCard from "@/components/services/ManageServiceCard";
import { getOwnerServicesPage } from "@/services/servicesService";

export default function MyServices() {
  const { user } = useAuth();
  const servicesQuery = useInfiniteQuery({
    queryKey: ["my-services", user?.id],
    queryFn: ({ pageParam }) => getOwnerServicesPage(user.id, { cursor: pageParam || null, limit: 30 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user?.id),
  });
  const services = useMemo(() => {
    const byId = new Map();
    for (const page of servicesQuery.data?.pages || []) {
      for (const service of page.items) byId.set(service.id, service);
    }
    return [...byId.values()];
  }, [servicesQuery.data]);
  const { isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = servicesQuery;

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BackButton className="-ml-2" />
            <div>
              <h1 className="text-2xl font-bold">My Services</h1>
              {!isLoading && services.length > 0 && <p className="text-xs text-muted-foreground">{services.length} loaded</p>}
            </div>
          </div>
          <Link to="/create-service" className="flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Offer
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16" role="status"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /><span className="sr-only">Loading your services</span></div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
            <p className="font-medium">We could not load your services</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Briefcase className="w-12 h-12 mb-3 stroke-1" />
            <p className="font-medium text-foreground">No services listed yet</p>
            <p className="text-sm mt-1">Offer a service to start getting clients.</p>
            <Link to="/create-service" className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <Plus className="w-4 h-4" /> Offer a Service
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => <ManageServiceCard key={service.id} service={service} />)}
            {hasNextPage && (
              <div className="flex justify-center pt-3">
                <Button type="button" variant="outline" className="min-w-48" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                  {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</> : 'Load more services'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
