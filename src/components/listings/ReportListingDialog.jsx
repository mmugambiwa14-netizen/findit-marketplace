import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getExistingListingReport, submitListingReport } from "@/services/reportsService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { GuestPromptSheet } from "@/components/auth/GuestPromptSheet";

export default function ReportListingDialog({ listing, listingType }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { guestOpen, guestAction, guard, closeGuest } = useGuestGuard();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Check if user already reported this listing
  const { data: existingReport = null } = useQuery({
    queryKey: ["report-check", listing?.id, user?.id],
    queryFn: () => getExistingListingReport(user.id, listing.id),
    enabled: !!listing?.id && !!user?.id,
  });

  const alreadyReported = Boolean(existingReport);

  const reportMutation = useMutation({
    mutationFn: () => submitListingReport({
      listing,
      listingType,
      reason,
      description,
      reporterId: user.id,
    }),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["report-check", listing?.id, user?.id] });
      toast.success("Report submitted. Thank you for helping keep PeekaListing safe.");
    },
    onError: () => toast.error("Failed to submit report. Please try again."),
  });

  const handleOpen = () => guard("report listings", () => {
    setSubmitted(false);
    setReason("");
    setDescription("");
    setOpen(true);
  });

  return (
    <>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />

      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        <Flag className="w-3 h-3" aria-hidden="true" />
        {alreadyReported ? "You reported this listing" : "Report this listing"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl mx-4 max-w-sm z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-base">Report Listing</DialogTitle>
          </DialogHeader>

          {submitted || alreadyReported ? (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <CheckCircle2 className="w-10 h-10 text-primary" />
              <p className="font-medium">Report received</p>
              <p className="text-sm text-muted-foreground">
                Our team will review this listing and take appropriate action.
              </p>
              <Button type="button" variant="outline" className="rounded-xl w-full" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {listing?.title && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 truncate">
                  {listing.title}
                </p>
              )}
              <div>
                <Label htmlFor="listing-report-reason" className="text-xs font-medium">Reason *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger id="listing-report-reason" className="mt-1 rounded-xl">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent className="z-[99999]">
                    <SelectItem value="fake">Fake / Misleading</SelectItem>
                    <SelectItem value="scam">Scam / Fraud</SelectItem>
                    <SelectItem value="duplicate">Duplicate listing</SelectItem>
                    <SelectItem value="wrong_price">Wrong / Suspicious price</SelectItem>
                    <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="listing-report-details" className="text-xs font-medium">Details <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="listing-report-details"
                  maxLength={2000}
                  className="mt-1 rounded-xl resize-none"
                  rows={3}
                  placeholder="Provide more details to help our team..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => reportMutation.mutate()}
                  disabled={!reason || reportMutation.isPending}
                  className="flex-1 rounded-xl"
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                </Button>
                <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
