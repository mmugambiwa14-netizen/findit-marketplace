import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const REQUIRED_CONFIRMATION = 'BAN';

export default function BanUserDialog({ open, onOpenChange, user, onConfirm, isLoading }) {
  const [duration, setDuration] = useState('7');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (open) return;
    setDuration('7');
    setReason('');
    setConfirmation('');
  }, [open]);

  const handleConfirm = () => {
    if (!user || confirmation.trim().toUpperCase() !== REQUIRED_CONFIRMATION) return;
    onConfirm({
      userId: user.user_id,
      duration_days: Number.parseInt(duration, 10),
      reason: reason.trim(),
    });
  };

  const activeAdverts = Number(user?.listing_count || 0) + Number(user?.service_count || 0);
  const canConfirm = Boolean(user)
    && reason.trim().length >= 3
    && confirmation.trim().toUpperCase() === REQUIRED_CONFIRMATION
    && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban account</DialogTitle>
          <DialogDescription>
            Temporarily block {user?.full_name || 'this user'} from using PeekaListing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-destructive/25 bg-destructive/8 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-bold">Account access will be blocked immediately.</p>
                <p className="mt-1 leading-6 text-muted-foreground">
                  The account currently has {activeAdverts.toLocaleString()} active or recorded advert{activeAdverts === 1 ? '' : 's'}. Existing records remain available for audit and restoration.
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="ban-duration">Ban duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="ban-duration" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="ban-reason">Reason for ban</Label>
            <Textarea
              id="ban-reason"
              maxLength={1000}
              placeholder="Describe the policy, safety, or operational reason."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 min-h-24"
            />
          </div>

          <div>
            <Label htmlFor="ban-confirmation">Type {REQUIRED_CONFIRMATION} to confirm</Label>
            <Input
              id="ban-confirmation"
              className="mt-1 uppercase"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={REQUIRED_CONFIRMATION}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isLoading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm}>
            {isLoading ? 'Banning…' : `Ban for ${duration} day${duration === '1' ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
