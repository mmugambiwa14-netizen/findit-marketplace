import { LocateFixed, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function LocationPermissionDialog({ open, onOpenChange, onAllow }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LocateFixed className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle>Use your location once?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left leading-6">
            <span className="block">
              PeekaListing will ask your browser for your device location and use it once to suggest your country, province or state, and nearest registered place.
            </span>
            <span className="flex items-start gap-2 rounded-xl border border-border bg-surface-secondary p-3 text-xs text-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Your coordinates are sent to PeekaListing’s location service for this lookup, but are not added to your profile or saved in this browser. Only the suggested public country, region, and place may be remembered on this device, and you can change or clear them.
            </span>
            <span className="block text-xs">
              This never saves your coordinates. PeekaListing currently serves Zimbabwe marketplace locations, which you can choose manually if your device is elsewhere.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={onAllow}>Allow once</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
