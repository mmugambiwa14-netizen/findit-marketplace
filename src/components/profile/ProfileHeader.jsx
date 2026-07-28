import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { User, Phone, Pencil } from "lucide-react";
import { getOwnerListingsCount } from "@/services/ownerListingsService";

/**
 * Instagram-style header for the current user's own profile.
 * Shows avatar, name, phone, bio and listings/followers stats.
 */
export default function ProfileHeader({ user }) {
  const email = user?.email;

  const { data: listingsCount = 0 } = useQuery({
    queryKey: ["my-listings-count", user?.id],
    queryFn: () => getOwnerListingsCount(user.id),
    enabled: Boolean(user?.id),
  });

  const avatarUrl = user?.avatar_url || null;
  const initial = (user?.full_name || email || "?").charAt(0).toUpperCase();

  return (
    <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-accent/5 px-4 pt-10 pb-6 rounded-b-[2rem]">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl border-4 border-card shadow-lg shadow-primary/20 overflow-hidden bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" loading="eager" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <User className="w-9 h-9 text-primary-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold truncate">{user?.full_name || "User"}</h1>
          </div>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          {user?.phone && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {user.phone}
              {!user?.phone_verified && <span className="text-accent-foreground">(unverified)</span>}
            </p>
          )}
        </div>
      </div>

      {user?.bio && (
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{user.bio}</p>
      )}

      <div className="flex items-center justify-between mt-4">
        <div>
          <p className="text-lg font-bold leading-none">{listingsCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Listings</p>
        </div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-card border border-border hover:bg-muted transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit Profile
        </Link>
      </div>
    </div>
  );
}
