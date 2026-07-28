import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, Loader2, Plus, Search, X } from "lucide-react";
import BackButton from "@/components/layout/BackButton";
import ServiceCategoryChips from "@/components/services/ServiceCategoryChips";
import ServiceGrid from "@/components/services/ServiceGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicServicesPage } from "@/services/servicesService";

export default function Services() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "all";
  const query = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => setSearchInput(query), [query]);
  useEffect(() => {
    const value = searchInput.trim();
    if (value === query) return undefined;
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set("q", value);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query, searchInput, searchParams, setSearchParams]);

  const servicesQuery = useInfiniteQuery({
    queryKey: ["services", category, query],
    queryFn: ({ pageParam }) => getPublicServicesPage({ category, query, limit: 24, cursor: pageParam || null }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 30000,
  });
  const services = useMemo(() => {
    const byId = new Map();
    for (const page of servicesQuery.data?.pages || []) {
      for (const service of page.items) byId.set(service.id, service);
    }
    return [...byId.values()];
  }, [servicesQuery.data]);
  const { isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = servicesQuery;

  const selectCategory = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("category");
    else next.set("category", value);
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-surface-secondary">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-2">
              <BackButton className="-ml-2 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Services</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Find the right professional</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Asset-related services from mechanics, builders, property professionals and equipment specialists.</p>
              </div>
            </div>
            <Button asChild className="hidden shrink-0 sm:inline-flex"><Link to="/create-service"><Plus className="mr-2 h-4 w-4" />Offer a service</Link></Button>
          </div>

          <div className="relative mt-5 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search services, providers or areas"
              aria-label="Search services"
              className="h-12 rounded-2xl pl-12 pr-12"
            />
            {searchInput && <button type="button" onClick={() => setSearchInput("")} aria-label="Clear search" className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <ServiceCategoryChips value={category} onChange={selectCategory} />
        <div className="mb-4 mt-6 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Available services</h2><p className="text-sm text-muted-foreground">{isLoading ? "Loading results" : `${services.length} result${services.length === 1 ? "" : "s"}`}</p></div>
          <BriefcaseBusiness className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>

        {error ? (
          <div className="surface-panel px-4 py-12 text-center"><p className="font-semibold">We could not load services</p><p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p><Button type="button" variant="outline" className="mt-4" onClick={() => refetch()}>Try again</Button></div>
        ) : (
          <>
            <ServiceGrid services={services} isLoading={isLoading} />
            {hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button type="button" variant="outline" className="min-w-48" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                  {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</> : 'Load more services'}
                </Button>
              </div>
            )}
            {!hasNextPage && services.length > 0 && <p className="mt-6 text-center text-xs text-muted-foreground">All matching services are loaded.</p>}
          </>
        )}
      </main>

      <Button asChild className="fixed bottom-20 right-4 z-40 rounded-full shadow-lg shadow-black/30 sm:hidden"><Link to="/create-service"><Plus className="mr-2 h-4 w-4" />Offer service</Link></Button>
    </div>
  );
}
