import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import ListingGrid from "@/components/listings/ListingGrid";
import MachineryGrid from "@/components/listings/MachineryGrid";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/AuthContext";
import { getFavouriteListingsPage } from "@/services/favouritesService";

export default function Saved() {
  const { user } = useAuth();
  const favouritesQuery = useInfiniteQuery({
    queryKey: ["favourite-listings", user?.id],
    queryFn: ({ pageParam }) => getFavouriteListingsPage(user.id, { cursor: pageParam || null, limit: 30 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });
  const favourites = useMemo(() => {
    const byId = new Map();
    for (const page of favouritesQuery.data?.pages || []) {
      for (const listing of page.items) byId.set(listing.id, listing);
    }
    return [...byId.values()];
  }, [favouritesQuery.data]);
  const { isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = favouritesQuery;
  const savedProperties = favourites.filter((listing) => listing._type === "property");
  const savedCars = favourites.filter((listing) => listing._type === "car");
  const savedMachinery = favourites.filter((listing) => listing._type === "machinery");
  const savedIds = favourites.map((listing) => listing.id);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" aria-label="Back to Discover" className="flex h-11 w-11 items-center justify-center rounded-xl"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex items-center gap-1.5">
          <Bookmark className="w-4 h-4 text-primary" />
          <h1 className="font-bold text-lg">Favourites</h1>
        </div>
        {favourites.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">{favourites.length} loaded</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16" role="status">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="sr-only">Loading favourites</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <Bookmark className="mb-3 h-12 w-12 stroke-1 text-muted-foreground" />
          <p className="font-medium">Favourites could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button type="button" onClick={() => refetch()} className="mt-4">Try again</Button>
        </div>
      ) : favourites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bookmark className="w-12 h-12 mb-3 stroke-1" />
          <p className="font-medium">No favourites yet</p>
          <p className="text-sm mt-1">Tap the heart icon on any listing to add it to your favourites</p>
        </div>
      ) : (
        <div className="px-4 py-4">
          <Tabs defaultValue="properties">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="properties">Properties ({savedProperties.length})</TabsTrigger>
              <TabsTrigger value="cars">Cars ({savedCars.length})</TabsTrigger>
              <TabsTrigger value="machinery">Machinery ({savedMachinery.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="properties" className="mt-4">
              <ListingGrid listings={savedProperties} type="property" savedIds={savedIds} />
            </TabsContent>
            <TabsContent value="cars" className="mt-4">
              <ListingGrid listings={savedCars} type="car" savedIds={savedIds} />
            </TabsContent>
            <TabsContent value="machinery" className="mt-4">
              <MachineryGrid listings={savedMachinery} />
            </TabsContent>
          </Tabs>
          {hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button type="button" variant="outline" className="min-w-48" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</> : 'Load more favourites'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
