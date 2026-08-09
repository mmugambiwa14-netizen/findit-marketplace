import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Globe2, Loader2, MapPin, MessageCircle, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import DealerListings from "@/components/dealers/DealerListings";
import BackButton from "@/components/layout/BackButton";
import { useAuth } from "@/lib/AuthContext";
import { isSellerProfileId } from "@/services/sellerProfileContracts";
import { getPublicSellerListingsPage, getPublicSellerProfile } from "@/services/sellerProfilesService";
import { revealContactDetails } from "@/repositories/contactRevealRepository";
import { goBackOrHome } from "@/lib/navigation";
import { CardGridSkeleton, ProfilePageSkeleton } from '@/components/loading/LoadingSkeletons';

function SellerProfileState({ children }) {
  return (
    <div className="min-h-[70vh] px-4 py-5">
      <div className="mx-auto max-w-3xl">
        <BackButton className="-ml-2" fallback="/search" label="Back to marketplace" />
        <div className="mx-auto max-w-lg py-12 text-center">{children}</div>
      </div>
    </div>
  );
}

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
      <SellerProfileState>
        <h1 className="text-xl font-semibold">Seller not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This seller link is unavailable or no longer supported.</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => goBackOrHome(navigate, '/')}>Go back</Button>
      </SellerProfileState>
    );
  }

  if (profileQuery.isLoading) {
    return <div className="min-h-[70vh] px-4 py-5"><div className="mx-auto max-w-3xl"><BackButton className="-ml-2" fallback="/search" label="Back to marketplace" /><ProfilePageSkeleton className="px-0" label="Loading seller profile" /></div></div>;
  }

  if (profileQuery.error) {
    return (
      <SellerProfileState>
        <h1 className="text-xl font-semibold">We could not load this seller</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => profileQuery.refetch()}>Try again</Button>
      </SellerProfileState>
    );
  }

  const profile = profileQuery.data;
  if (!profile) {
    return (
      <SellerProfileState>
        <h1 className="text-xl font-semibold">Seller not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This profile is unavailable or has no active public listings.</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => goBackOrHome(navigate, '/')}>Go back</Button>
      </SellerProfileState>
    );
  }

  const sellerName = profile.display_name || profile.full_name || "PeekaListing seller";
  const sellerBio = profile.bio || "";
  const avatarUrl = profile.avatar_url || "";
  const isOwnProfile = user?.id === profile.id;
  const publicListings = listings.map((listing) => ({
    ...listing,
    seller_name: sellerName,
  }));
  const revealed = revealQuery.data ?? null;
  const whatsapp = contactSource?.contact_whatsapp || revealed?.contact_whatsapp
    || contactSource?.contact_phone || revealed?.contact_phone || "";
  const phone = contactSource?.contact_phone || revealed?.contact_phone
    || contactSource?.contact_whatsapp || revealed?.contact_whatsapp || "";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={() => goBackOrHome(navigate, '/')} className="flex h-11 w-11 items-center justify-center rounded-xl" aria-label="Go back"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-bold text-lg">Seller profile</h1>
      </header>

      <section className="border-b border-border bg-card px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[1.75rem] border border-border/80 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--primary)/.22),transparent_48%),linear-gradient(145deg,hsl(var(--surface-raised)/.72),hsl(var(--card)))] p-5 shadow-[0_18px_42px_hsl(var(--clay-shadow-dark)/.35)] sm:p-6">
            <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-primary/30 bg-primary/15 shadow-[inset_0_1px_rgba(255,255,255,.12),0_12px_28px_hsl(var(--primary)/.2)]">
              {avatarUrl ? <img src={avatarUrl} alt={`${sellerName} profile`} loading="eager" decoding="async" className="h-full w-full object-cover" /> : <User className="h-9 w-9 text-primary-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Seller profile</p>
              <h2 className="mt-1 truncate text-xl font-black tracking-tight">{sellerName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{listings.length.toLocaleString()} active {listings.length === 1 ? "listing" : "listings"}</p>
            </div>
          </div>

            {(profile.public_address || profile.website_url) && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {profile.public_address && (
                  <div className="flex min-w-0 items-start gap-2.5 rounded-2xl border border-border/70 bg-card/70 px-3.5 py-3 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 break-words">{profile.public_address}</span>
                  </div>
                )}
                {profile.website_url && (
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/70 bg-card/70 px-3.5 py-3 text-sm text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{profile.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}

            {sellerBio && <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{sellerBio}</p>}

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
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 p-4">
        <div>
          <h2 className="font-black text-xl tracking-tight">Listings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse the seller's active marketplace inventory.</p>
        </div>
        {listingsQuery.isLoading ? (
          <CardGridSkeleton count={6} label="Loading seller listings" />
        ) : listingsQuery.error ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center"><p>Seller listings could not be loaded.</p><Button type="button" variant="outline" className="mt-4" onClick={() => listingsQuery.refetch()}>Try again</Button></div>
        ) : (
          <>
            <DealerListings listings={publicListings} />
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
