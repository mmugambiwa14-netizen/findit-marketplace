import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Building2, ExternalLink, Loader2, Mail, MapPin, MessageCircle, Phone, Search } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import DealerListings from '@/components/dealers/DealerListings';
import ServiceCard from '@/components/services/ServiceCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getPublicBusinessInventoryPage,
  getPublicBusinessProfile,
  getPublicBusinessServicesPage,
} from '@/services/businessProfilesService';

function contactNumber(value) {
  return value?.replace(/[^0-9]/g, '') ?? '';
}

function flattenUnique(pages = []) {
  const byId = new Map();
  for (const page of pages) for (const item of page.items) byId.set(item.id, item);
  return [...byId.values()];
}

export default function PublicBusinessProfile() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const inventoryQuery = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(inventoryQuery);
  useEffect(() => setSearch(inventoryQuery), [inventoryQuery]);

  const profileQuery = useQuery({
    queryKey: ['public-business-profile', id],
    queryFn: () => getPublicBusinessProfile(id),
    enabled: Boolean(id),
  });
  const profile = profileQuery.data;
  const dealer = profile?.profile_type === 'dealer';

  const inventoryPages = useInfiniteQuery({
    queryKey: ['public-business-inventory', profile?.user_id, dealer, inventoryQuery],
    queryFn: ({ pageParam }) => getPublicBusinessInventoryPage(profile.user_id, {
      dealerOnly: dealer,
      query: dealer ? inventoryQuery : '',
      cursor: pageParam || null,
      limit: 24,
    }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(profile?.user_id),
  });
  const servicePages = useInfiniteQuery({
    queryKey: ['public-business-services', profile?.user_id],
    queryFn: ({ pageParam }) => getPublicBusinessServicesPage(profile.user_id, { cursor: pageParam || null, limit: 24 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(profile?.user_id && !dealer),
  });
  const inventory = useMemo(() => flattenUnique(inventoryPages.data?.pages), [inventoryPages.data]);
  const services = useMemo(() => flattenUnique(servicePages.data?.pages), [servicePages.data]);

  if (profileQuery.isLoading) {
    return <div className="flex justify-center py-20" role="status"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /><span className="sr-only">Loading business profile</span></div>;
  }
  if (profileQuery.error) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center"><h1 className="text-xl font-semibold">We could not load this profile</h1><p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p><Button type="button" variant="outline" className="mt-5" onClick={() => profileQuery.refetch()}>Try again</Button></div>;
  }
  if (!profile) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center"><h1 className="text-xl font-semibold">Profile not found</h1><p className="mt-2 text-sm text-muted-foreground">This business is unavailable or no longer active.</p><Button asChild variant="outline" className="mt-5"><Link to="/search">Browse FindIt</Link></Button></div>;
  }

  const whatsapp = contactNumber(profile.phone);
  return (
    <div className="min-h-screen bg-muted/20">
      <section className="border-b bg-card px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">
              {profile.avatar_url ? <img src={profile.avatar_url} alt={`${profile.company_name} logo`} className="h-full w-full object-cover" /> : <Building2 className="h-11 w-11 text-primary" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary">{dealer ? 'Vehicle dealer' : 'Business'}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">{profile.company_name}</h1>
              {profile.city && <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{profile.city}</p>}
              {profile.description && <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">{profile.description}</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {profile.phone && <Button className="min-h-11" onClick={() => { window.location.href = `tel:${profile.phone}`; }}><Phone className="mr-2 h-4 w-4" />Call</Button>}
            {whatsapp && <Button className="min-h-11" variant="outline" onClick={() => window.open(`https://wa.me/${whatsapp}`, '_blank', 'noopener,noreferrer')}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button>}
            {profile.email && <Button className="min-h-11" variant="outline" onClick={() => { window.location.href = `mailto:${profile.email}`; }}><Mail className="mr-2 h-4 w-4" />Email</Button>}
          </div>
          {(profile.address || profile.website || Object.keys(profile.social_links).length > 0) && (
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {profile.address && <span className="text-muted-foreground">{profile.address}</span>}
              {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Website <ExternalLink className="h-3.5 w-3.5" /></a>}
              {Object.entries(profile.social_links).map(([network, url]) => <a key={network} href={url} target="_blank" rel="noopener noreferrer" className="capitalize text-primary hover:underline">{network}</a>)}
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-7">
        <section aria-labelledby="business-inventory-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 id="business-inventory-heading" className="text-xl font-bold">{dealer ? 'Vehicle inventory' : 'Listings'}</h2><p className="mt-1 text-sm text-muted-foreground">{inventory.length} active {inventory.length === 1 ? 'listing' : 'listings'} loaded</p></div>
            {dealer && (
              <form className="flex w-full gap-2 sm:max-w-sm" onSubmit={(event) => { event.preventDefault(); const next = search.trim(); setSearchParams(next ? { q: next } : {}); }}>
                <label htmlFor="dealer-inventory-search" className="sr-only">Search dealer inventory</label>
                <Input id="dealer-inventory-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this inventory" maxLength={100} />
                <Button type="submit" size="icon" aria-label="Search inventory"><Search className="h-4 w-4" /></Button>
              </form>
            )}
          </div>
          <Card className="mt-4"><CardContent className="p-4">
            {inventoryPages.isLoading ? <div className="flex justify-center py-12" role="status"><Loader2 className="h-7 w-7 animate-spin" /><span className="sr-only">Loading inventory</span></div> : inventoryPages.error ? <div className="py-10 text-center"><p>Inventory could not be loaded.</p><Button type="button" variant="outline" className="mt-4" onClick={() => inventoryPages.refetch()}>Try again</Button></div> : <DealerListings listings={inventory} />}
            {inventoryPages.hasNextPage && <div className="mt-5 flex justify-center"><Button type="button" variant="outline" className="min-w-48" disabled={inventoryPages.isFetchingNextPage} onClick={() => inventoryPages.fetchNextPage()}>{inventoryPages.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more listings'}</Button></div>}
          </CardContent></Card>
        </section>

        {!dealer && (servicePages.isLoading || servicePages.error || services.length > 0) && (
          <section aria-labelledby="business-services-heading">
            <h2 id="business-services-heading" className="text-xl font-bold">Services</h2>
            {servicePages.isLoading ? <div className="flex justify-center py-12" role="status"><Loader2 className="h-7 w-7 animate-spin" /><span className="sr-only">Loading services</span></div> : servicePages.error ? <div className="mt-4 rounded-xl border bg-card p-6 text-center"><p>Services could not be loaded.</p><Button type="button" variant="outline" className="mt-4" onClick={() => servicePages.refetch()}>Try again</Button></div> : <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 md:grid-cols-3">{services.map((service) => <ServiceCard key={service.id} service={service} />)}</div>}
            {servicePages.hasNextPage && <div className="mt-5 flex justify-center"><Button type="button" variant="outline" className="min-w-48" disabled={servicePages.isFetchingNextPage} onClick={() => servicePages.fetchNextPage()}>{servicePages.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more services'}</Button></div>}
          </section>
        )}
      </main>
    </div>
  );
}
