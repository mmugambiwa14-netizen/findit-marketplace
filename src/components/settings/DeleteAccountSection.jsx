import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { deleteCurrentAccount } from '@/services/accountDeletionService';
import * as authService from '@/services/authService';
import { userFacingError } from '@/lib/userFacingErrors';

export default function DeleteAccountSection({ user }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const confirmed = confirmation.trim().toUpperCase() === 'DELETE';
  const protectedAccount = user?.role === 'admin' || user?.super_admin;

  const close = () => {
    if (deleting) return;
    setOpen(false);
    setConfirmation('');
  };

  const removeAccount = async (event) => {
    event.preventDefault();
    if (!confirmed || deleting || protectedAccount) return;
    setDeleting(true);
    try {
      await deleteCurrentAccount(confirmation);
      try { await authService.signOut(); } catch { /* the server has already revoked access */ }
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.location.replace(authService.appUrl('/login?accountDeleted=1'));
    } catch (error) {
      toast.error(userFacingError(error, 'We could not delete your account. Please try again.'));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Deleting your account closes access immediately, removes your public contact details, unpublishes your listings and services, and deletes disposable account data.
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        Some transaction, safety, moderation, dispute, and audit records may be kept in anonymised form where they are still needed. This action cannot be undone.
      </p>

      {protectedAccount ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          Administrator responsibilities must be transferred before this account can be deleted.
        </div>
      ) : (
        <AlertDialog open={open} onOpenChange={(next) => { if (next) setOpen(true); else close(); }}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" className="rounded-xl">
              <Trash2 className="h-4 w-4" />
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <AlertDialogTitle>Delete your FindIt account?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">You will be signed out on every device. Your listings, services, profile and contact methods will no longer be public.</span>
                <span className="block font-medium text-foreground">This cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 py-2">
              <Label htmlFor="delete-account-confirmation">Type DELETE to confirm</Label>
              <Input
                id="delete-account-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={deleting}
                placeholder="DELETE"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting} onClick={close}>Keep account</AlertDialogCancel>
              <AlertDialogAction
                onClick={removeAccount}
                disabled={!confirmed || deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting account…</> : 'Delete permanently'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
