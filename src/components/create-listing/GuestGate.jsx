import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, UserPlus, LogIn } from "lucide-react";

export function GuestGate() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 text-center">
      <Home className="mb-4 h-12 w-12 text-primary" aria-hidden="true" />
      <h2 className="text-2xl font-extrabold mb-2">Start listing on PeekaListing</h2>
      <p className="text-muted-foreground text-sm mb-8">Create a free account to post properties, cars and machinery for sale or rent.</p>
      <div className="w-full max-w-sm space-y-3">
        <Button asChild className="w-full h-12 rounded-xl text-base font-semibold">
          <Link to="/register"><UserPlus className="w-5 h-5 mr-2" /> Create Free Account</Link>
        </Button>
        <Button asChild variant="outline" className="w-full h-12 rounded-xl text-base">
          <Link to="/login"><LogIn className="w-5 h-5 mr-2" /> Sign In</Link>
        </Button>
      </div>
    </div>
  );
}
