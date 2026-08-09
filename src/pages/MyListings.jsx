import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, MoreVertical, RefreshCw, Pencil, Send, Pause, Play, Ban, Loader2 } from "lucide-react";
import EditListingDialog from "@/components/listings/EditListingDialog";
import { useTimeAgo } from "@/hooks/useTimeAgo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatPrice } from "@/lib/constants";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { goBackOrHome } from "@/lib/navigation";
import { getListingPlaceholder } from "@/lib/listingPlaceholders";
import { invalidateCanonicalParentQueries } from "@/lib/canonicalQueryInvalidation";
import {
  deleteOwnerListing,
  getOwnerListingsPage,
} from "@/services/ownerListingsService";
import { changeOwnerListingState } from '@/services/listingCreationService';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const placeholderProperty = getListingPlaceholder("property");
const placeholderCar = getListingPlaceholder("car");

const SOURCE_LABELS = {
  csv: "CSV Upload", pdf: "PDF Import", duplicate: "Duplicated",
  template: "From Template", developer: "Developer Tool",
};

const STATUS_CLASSES = {
  draft:       "bg-muted text-muted-foreground border-border",
  pending_review: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  rejected:    "bg-destructive/10 text-destructive border-destructive/30",
  available:   "bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400",
  paused:      "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
  unavailable: "bg-muted text-muted-foreground border-border",
  under_offer: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30 dark:text-yellow-400",
  sold:        "bg-destructive/10 text-destructive border-destructive/30",
  rented:      "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400",
  expired:     "bg-muted text-muted-foreground border-border",
};

export default function MyListings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const ownerListingsKey = ["my-listings", user?.id];
  const listingsQuery = useInfiniteQuery({
    queryKey: ownerListingsKey,
    queryFn: ({ pageParam }) => getOwnerListingsPage(user.id, { cursor: pageParam || null, limit: 30 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user?.id),
  });
  const allListings = useMemo(() => {
    const byId = new Map();
    for (const page of listingsQuery.data?.pages || []) {
      for (const listing of page.items) byId.set(listing.id, listing);
    }
    return [...byId.values()];
  }, [listingsQuery.data]);
  const { isLoading, error: listingsError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = listingsQuery;

  const refreshOwnerListings = (listing = null) => {
    queryClient.invalidateQueries({ queryKey: ownerListingsKey });
    if (listing?.id) {
      invalidateCanonicalParentQueries(queryClient, {
        parentType: 'listing',
        parentId: listing.id,
        kind: listing.type || listing._type || allListings.find((row) => row.id === listing.id)?._type || null,
      });
    }
  };

  const deleteListing = useMutation({
    mutationFn: (
      /** @type {{ id: string, type: string, photoPaths: Array<string> }} */
      { id, type, photoPaths }
    ) => deleteOwnerListing(user.id, type, id, photoPaths),
    onSuccess: (_, variables) => {
      refreshOwnerListings(variables);
      toast.success("Listing deleted");
    },
    onError: (error) => toast.error(error.message || "Unable to delete the listing"),
  });

  const changeListingStatus = useMutation({
    mutationFn: (
      /** @type {{ id: string, action: string, successMessage: string }} */
      { id, action }
    ) => changeOwnerListingState(id, action),
    onSuccess: (_, variables) => {
      refreshOwnerListings(variables);
      const { successMessage } = variables;
      toast.success(successMessage);
    },
    onError: (error) => toast.error(error.message || "Unable to update the listing"),
  });

  const [editing, setEditing] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const draftListings = allListings.filter(l => ["draft", "rejected"].includes(l.status));
  const pendingListings = allListings.filter(l => l.status === "pending_review");
  const activeListings = allListings.filter(l => ["available", "under_offer", "rented", "paused"].includes(l.status));
  const expiredListings = allListings.filter(l => ["expired", "unavailable"].includes(l.status));
  const requestDelete = (listing) => setDeleteCandidate(listing);

  const confirmDelete = () => {
    if (!deleteCandidate || deleteListing.isPending) return;
    deleteListing.mutate({
      id: deleteCandidate.id,
      type: deleteCandidate._type,
      photoPaths: deleteCandidate.photo_paths || [],
    }, {
      onSuccess: () => setDeleteCandidate(null),
    });
  };

  return (
    <div className="min-h-[100dvh]">
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => goBackOrHome(navigate, '/')} className="p-1" aria-label="Go back"><ArrowLeft className="w-5 h-5" /></button>
          <div><h1 className="font-bold text-lg">My Listings</h1>{!isLoading && allListings.length > 0 && <p className="text-xs text-muted-foreground">Showing {allListings.length}</p>}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="rounded-xl">
            <Link to="/post"><Plus className="w-4 h-4 mr-1" /> New</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ListRowsSkeleton rows={7} className="px-4 py-4" label="Loading your listings" />
      ) : listingsError ? (
        <div className="mx-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center">
          <p className="font-medium">We could not load your listings</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : allListings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground px-4">
          <p className="font-medium">No listings yet</p>
          <p className="text-sm mt-1">Create your first listing to get started</p>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/post"><Plus className="w-4 h-4 mr-1" /> Create Listing</Link>
          </Button>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {draftListings.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium px-2">Needs attention ({draftListings.length})</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {draftListings.map(listing => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  onDelete={() => requestDelete(listing)}
                  onEdit={() => setEditing(listing)}
                  onPublish={() => changeListingStatus.mutate({
                    id: listing.id,
                    action: "submit",
                    successMessage: "Listing published",
                  })}
                />
              ))}
            </>
          )}

          {pendingListings.length > 0 && (
            <>
              <div className="flex items-center gap-2"><div className="h-px flex-1 bg-border" /><span className="px-2 text-xs font-medium text-muted-foreground">Finishing publication ({pendingListings.length})</span><div className="h-px flex-1 bg-border" /></div>
              {pendingListings.map((listing) => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  onDelete={() => requestDelete(listing)}
                  onEdit={() => setEditing(listing)}
                />
              ))}
            </>
          )}

          {activeListings.map(listing => (
            <ListingRow
              key={listing.id}
              listing={listing}
              onDelete={() => requestDelete(listing)}
              onEdit={['available', 'under_offer'].includes(listing.status) ? () => setEditing(listing) : undefined}
              onPause={listing.status === 'paused' ? undefined : () => changeListingStatus.mutate({ id: listing.id, action: 'pause', successMessage: 'Listing paused' })}
              onResume={listing.status === 'paused' ? () => changeListingStatus.mutate({ id: listing.id, action: 'resume', successMessage: 'Listing is live again' }) : undefined}
              onUnavailable={() => changeListingStatus.mutate({ id: listing.id, action: 'unavailable', successMessage: 'Listing marked unavailable' })}
            />
          ))}

          {expiredListings.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium px-2">Ended ({expiredListings.length})</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {expiredListings.map(listing => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  onDelete={() => requestDelete(listing)}
                  onEdit={listing.status === 'expired' ? () => setEditing(listing) : undefined}
                  onRenew={() => changeListingStatus.mutate({
                    id: listing.id,
                    action: "submit",
                    successMessage: "Listing published",
                  })}
                />
              ))}
            </>
          )}
          {hasNextPage && (
            <div className="flex justify-center pt-3">
              <Button type="button" variant="outline" className="min-w-48" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</> : 'Load more listings'}
              </Button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditListingDialog
          listing={editing}
          ownerId={user.id}
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
        />
      )}

      <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={(open) => { if (!open && !deleteListing.isPending) setDeleteCandidate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate ? `"${deleteCandidate.title}" will be permanently deleted. This cannot be undone.` : 'This listing will be permanently deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteListing.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteListing.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteListing.isPending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Deleting</> : 'Delete listing'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * @param {{
 *   listing: any,
 *   onDelete: () => void,
 *   onRenew?: () => void,
 *   onEdit?: () => void,
 *   onPublish?: () => void,
 *   onPause?: () => void,
 *   onResume?: () => void,
 *   onUnavailable?: () => void
 * }} props
 */
function ListingRow({ listing, onDelete, onRenew, onEdit, onPublish, onPause, onResume, onUnavailable }) {
  const photo = listing.photos?.[0] || (listing._type === "property" ? placeholderProperty : placeholderCar);
  const link = listing._type === "property" ? `/property/${listing.id}` : listing._type === "car" ? `/car/${listing.id}` : `/machinery/${listing.id}`;
  const timeAgo = useTimeAgo(listing.created_date);
  const isExpired = listing.status === "expired";
  const isDraft = ["draft", "rejected"].includes(listing.status);
  const expiryLabel = listing.expires_at
    ? new Date(listing.expires_at).toLocaleDateString('en-ZW', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null;

  return (
    <div className={cn("flex gap-3 bg-card border rounded-xl p-3 transition-opacity", isExpired ? "border-border/30 opacity-70" : "border-border/50")}>
      <Link to={link} className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 relative">
        <img src={photo} alt={listing.title} loading="lazy" decoding="async" className={cn("w-full h-full object-cover", isExpired && "grayscale")} />
        {isExpired && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-[9px] font-bold tracking-wide">EXPIRED</span>
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <Link to={link} className="font-semibold text-sm truncate block flex-1 text-foreground">
            {listing.title}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="p-0.5" aria-label={`Listing actions for ${listing.title}`}>
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
              )}
              {onPause && <DropdownMenuItem onClick={onPause}><Pause className="mr-2 h-4 w-4" />Pause</DropdownMenuItem>}
              {onResume && <DropdownMenuItem onClick={onResume}><Play className="mr-2 h-4 w-4" />Resume</DropdownMenuItem>}
              {onUnavailable && <DropdownMenuItem onClick={onUnavailable}><Ban className="mr-2 h-4 w-4" />Mark unavailable</DropdownMenuItem>}
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-primary font-bold text-sm">{formatPrice(listing.price, listing.currency)}</p>
        {listing.status === "rejected" && listing.moderation_reason && (
          <p className="mt-1 text-xs text-destructive">Unavailable note: {listing.moderation_reason}</p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", STATUS_CLASSES[listing.status])}>
            {listing.status?.replace("_", " ")}
          </Badge>
          {listing.created_via && SOURCE_LABELS[listing.created_via] && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
              {SOURCE_LABELS[listing.created_via]}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          {!isDraft && expiryLabel && (
            <span className="text-[10px] text-muted-foreground">Expires {expiryLabel}</span>
          )}
        </div>
        {isExpired && onRenew && (
          <button type="button"
            onClick={onRenew}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Renew Listing
          </button>
        )}
        {(isDraft || listing.status === 'pending_review') && (onEdit || onPublish) && (
          <div className="mt-2 flex items-center gap-2">
            {onEdit && (
              <button type="button"
                onClick={onEdit}
                className="flex items-center gap-1 text-xs font-semibold text-foreground bg-muted hover:bg-muted/70 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            {onPublish && (
              <button type="button"
                onClick={onPublish}
                className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Send className="w-3 h-3" /> Publish
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
