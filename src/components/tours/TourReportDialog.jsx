import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { reportListingTour } from '@/services/listingToursService';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';

const REASONS = [
  ['unrelated_video', 'Video is unrelated to the listing'],
  ['misleading_representation', 'Misleading representation'],
  ['stolen_content', 'Stolen content'],
  ['unsafe_content', 'Unsafe content'],
  ['inappropriate_content', 'Inappropriate content'],
  ['prohibited_watermark', 'Prohibited watermark'],
  ['suspected_fraud', 'Suspected fraud'],
  ['duplicate_content', 'Duplicate content'],
];

export default function TourReportDialog({ open, onOpenChange, tourId, title, onReported }) {
  const [reason, setReason] = useState('misleading_representation');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => reportListingTour({ tourId, reason, description }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listingTourQueryKeys.all });
      setDescription('');
      setReason('misleading_representation');
      onOpenChange(false);
      onReported?.(tourId);
      toast.success('Peek reported for review');
    },
    onError: (error) => toast.error(error.message || 'Unable to report this Peek'),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flag className="h-5 w-5 text-destructive" />Report Peek</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Report only the video attached to <span className="font-medium text-foreground">{title}</span>. The parent listing remains a separate moderation target.</p>
        <div className="space-y-2">
          <Label htmlFor="tour-report-reason">Reason</Label>
          <Select value={reason} onValueChange={setReason} disabled={mutation.isPending}>
            <SelectTrigger id="tour-report-reason"><SelectValue /></SelectTrigger>
            <SelectContent>{REASONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tour-report-description">Details (optional)</Label>
          <Textarea
            id="tour-report-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Describe what is wrong with the video. Do not include private information."
            disabled={mutation.isPending}
          />
          <p className="text-right text-xs text-muted-foreground">{description.length}/2000</p>
        </div>
        <Button type="button" variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Submitting…' : 'Submit Peek report'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
