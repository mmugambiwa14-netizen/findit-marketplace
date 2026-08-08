import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageCircle, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import DealerListings from "@/components/dealers/DealerListings";
import { useAuth } from "@/lib/AuthContext";
import { isSellerProfileId } from "@/services/sellerProfileContracts";
import { getPublicSellerListingsPage, getPublicSellerProfile } from "@/services/sellerProfilesService";
import { revealContactDetails } from "@/repositories/contactRevealRepository";

export default function SellerProfile() {
  const { sellerId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const validSellerId = isSellerProfileId(sellerId);

  const profileQuery = useQuery({
    queryKey: ["seller-public-profile", sellerId.toLowerCase()],
    queryFn: () => getPublicSellerProfile(sellerId),
    enabled: validSellerId,
  });
  const profileSellerId = profileQuery.data?.id || null;
  const listingsQuery = useInfiniteQuery({
    queryKey: ["seller-public-listings", profileSellerId],
    queryFn: ({ pageParam }) => getPublicSellerListingsPage(profileSellerId, { cursor: pageParam || null, limit: 24 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(profileSellerId),
  });
  const listings = useMemo(() => {
    const byId = new Map();
    for (const page of listingsQuery.data?.pages || []) {
      for (const listing of page.items) byId.set(listing.id, listing);
    }
    return [...byId.values()];
  }, [listingsQuery.data]);

  // Seller phone numbers are no longer part of the public listing payload.
  // Signed-in, non-owner viewers resolve them through the audited reveal RPC;
  // logged-out visitors simply do not get the direct-contact buttons.
  // Declared before the early returns below so hook order stays stable.
  const contactSource = listings.find(
    (listing) => listing.contact_whatsapp || listing.contact_phone
      || listing.has_contact_whatsapp || listing.has_contact_phone,
  );
  const viewerOwnsProfile = Boolean(user) && user.id === profileSellerId;
  const revealQuery = useQuery({
    queryKey: ["seller-contact-reveal", contactSource?.id ?? null],
    queryFn: () => revealContactDetails(contactSource._type || "property", contactSource.id),
    enabled: Boolean(contactSource) && Boolean(user) && !viewerOwnsProfile
      && !contactSource?.contact_phone && !contactSource?.contact_whatsapp,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!validSellerId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Seller not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This seller link is unavailable or no longer supported.</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  if (profileQuery.isLoading) {
    return <div className="flex items-center justify-center py-12" role="status"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /><span className="sr-only">Loading seller profile</span></div>;
  }

  if (profileQuery.error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">We could not load this seller</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => profileQuery.refetch()}>Try again</Button>
      </div>
    );
  }

  const profile = profileQuery.data;
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Seller not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This profile is unavailable or has no active public listings.</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const sellerName = profile.full_name || listings[0]?.seller_name || "PeekaListing seller";
  const sellerBio = profile.bio || "";
  const avatarUrl = profile.avatar_url || "";
  const isOwnProfile = user?.id === profile.id;
  const revealed = revealQuery.data ?? null;
  const whatsapp = contactSource?.contact_whatsapp || revealed?.contact_whatsapp
    || contactSource?.contact_phone || revealed?.contact_phone || "";
  const phone = contactSource?.contact_phone || revealed?.contact_phone
    || contactSource?.contact_whatsapp || revealed?.contact_whatsapp || "";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={() => navigate(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl" aria-label="Go back"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-bold text-lg">Seller profile</h1>
      </header>

      <section className="border-b border-border bg-card px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary">
              {avatarUrl ? <img src={avatarUrl} alt={`${sellerName} profile`} loading="eager" decoding="async" className="h-full w-full object-cover" /> : <User className="h-9 w-9 text-primary-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold">{sellerName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Showing {listings.length} active {listings.length === 1 ? "listing" : "listings"}</p>
            </div>
          </div>

          {sellerBio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{sellerBio}</p>}

          {!isOwnProfile && phone && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {whatsapp && (
                <Button className="bg-green-600 text-white hover:bg-green-700" onClick={() => {
                  const number = whatsapp.replace(/[^0-9]/g, "");
                  const message = encodeURIComponent("Hi, I'm interested in one of your PeekaListing listings.");
                  window.open(`https://wa.me/${number}?text=${message}`, "_blank", "noopener,noreferrer");
                }}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp</Button>
              )}
              <Button variant="outline" onClick={() => { window.location.href = `tel:${phone}`; }}><Phone className="mr-2 h-4 w-4" /> Call</Button>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 p-4">
        <h2 className="font-bold text-lg">Listings</h2>
        {listingsQuery.isLoading ? (
          <div className="flex justify-center py-12" role="status"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="sr-only">Loading seller listings</span></div>
        ) : listingsQuery.error ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center"><p>Seller listings could not be loaded.</p><Button type="button" variant="outline" className="mt-4" onClick={() => listingsQuery.refetch()}>Try again</Button></div>
        ) : (
          <>
            <DealerListings listings={listings} />
            {listingsQuery.hasNextPage && (
              <div className="flex justify-center">
                <Button type="button" variant="outline" className="min-w-48" disabled={listingsQuery.isFetchingNextPage} onClick={() => listingsQuery.fetchNextPage()}>
                  {listingsQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more listings'}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
