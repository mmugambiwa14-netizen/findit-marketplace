import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useCursorStack } from '@/hooks/useCursorStack';
import CursorPager from '@/components/admin/CursorPager';
import SupportRequestInbox from '@/components/admin/SupportRequestInbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getAdminReports, reviewAdminReport } from '@/services/adminService';

const PAGE_SIZE = 20;
const reasonLabels = {
  fake: 'Fake / misleading',
  scam: 'Scam / fraud',
  duplicate: 'Duplicate',
  wrong_price: 'Wrong price',
  inappropriate: 'Inappropriate',
  spam: 'Spam',
  harassment: 'Harassment',
  unsafe: 'Unsafe behaviour',
  other: 'Other',
  unrelated_video: 'Unrelated Peek',
  misleading_representation: 'Misleading representation',
  stolen_content: 'Stolen content',
  unsafe_content: 'Unsafe content',
  inappropriate_content: 'Inappropriate content',
  prohibited_watermark: 'Prohibited watermark',
  suspected_fraud: 'Suspected fraud',
  duplicate_content: 'Duplicate content',
};
const severeReasons = new Set([
  'fake', 'scam', 'harassment', 'unsafe', 'unsafe_content',
  'inappropriate_content', 'suspected_fraud', 'stolen_content',
]);

function parentPath(report) {
  if (report.service_id) return `/service/${report.service_id}`;
  if (!report.listing_id) return null;
  const segment = report.listing_type === 'vehicle' ? 'car' : report.listing_type;
  return `/${segment}/${report.listing_id}`;
}

function targetType(report) {
  if (report.target_type === 'tour' || report.tour_id) return 'peek';
  if (report.target_type === 'message' || report.listing_type === 'message') return 'message';
  return 'marketplace';
}

export default function AdminReports() {
  const [showSupport, setShowSupport] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('pending');
  const [kind, setKind] = useState('all');
  const pagination = useCursorStack();
  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();
  const request = { query, status, kind, limit: PAGE_SIZE, cursor: pagination.cursor };

  const reportsQuery = useQuery({
    queryKey: ['admin-reports', request],
    queryFn: () => getAdminReports(request),
    enabled: !showSupport,
  });

  const mutation = useMutation({
    mutationFn: reviewAdminReport,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['listing-tours'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-marketplace'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
      setDecision(null);
      setNotes('');
      toast.success('Report decision recorded');
    },
    onError: (failure) => toast.error(failure.message),
  });

  const data = reportsQuery.data ?? { items: [], nextCursor: null };
  const openDecision = (report, nextStatus) => {
    setDecision({ report, status: nextStatus });
    setNotes('');
  };

  if (showSupport) return <SupportRequestInbox onShowReports={() => setShowSupport(false)} />;

  const type = decision ? targetType(decision.report) : null;
  const actionTitle = decision?.status === 'actioned'
    ? type === 'message' ? 'Close reported conversation'
      : type === 'peek' ? 'Remove reported Peek'
        : 'Remove reported marketplace item'
    : decision?.status === 'dismissed'
      ? type === 'peek' ? 'Dismiss report and restore Peek' : 'Dismiss report'
      : 'Mark report reviewed';

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-3xl font-bold">Safety reports</h1>
            <p className="mt-1 text-muted-foreground">
              Investigate user reports and take post-publication safety action. Listings and Peeks do not wait for routine approval.
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowSupport(true)}>Support requests</Button>
        </div>

        <Card>
          <CardContent className="grid gap-3 pt-5 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search reports"
                className="pl-9"
                value={query}
                onChange={(event) => { setQuery(event.target.value); pagination.reset(); }}
                placeholder="Title, reporter, or reason"
              />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); pagination.reset(); }}>
              <SelectTrigger aria-label="Filter reports by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={(value) => { setKind(value); pagination.reset(); }}>
              <SelectTrigger aria-label="Filter reports by target type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="tour">Peeks</SelectItem>
                <SelectItem value="property">Property</SelectItem>
                <SelectItem value="vehicle">Vehicles</SelectItem>
                <SelectItem value="machinery">Machinery</SelectItem>
                <SelectItem value="service">Services</SelectItem>
                <SelectItem value="message">Messages</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {reportsQuery.error && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{reportsQuery.error.message}</p>
        )}
        {reportsQuery.isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading reports…</Card>
        ) : data.items.length === 0 ? (
          <Card className="p-10 text-center">
            <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-muted-foreground">No reports match these filters.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.items.map((report) => (
              <ReportCard key={report.report_id} report={report} onDecision={openDecision} />
            ))}
          </div>
        )}

        <CursorPager
          pageNumber={pagination.pageNumber}
          itemCount={data.items.length}
          itemLabel="reports"
          canGoBack={pagination.canGoBack}
          canGoForward={Boolean(data.nextCursor)}
          onBack={pagination.back}
          onForward={() => pagination.forward(data.nextCursor)}
        />
      </div>

      <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && !mutation.isPending && setDecision(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionTitle}</DialogTitle></DialogHeader>
          {decision?.status === 'actioned' && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {type === 'message'
                ? 'The conversation will be closed so neither participant can send more messages.'
                : type === 'peek'
                  ? 'Only the reported Peek will be removed. Its parent listing or service remains intact unless separately reported.'
                  : 'The reported marketplace item will be removed and related reports resolved.'}
            </p>
          )}
          {decision?.status === 'dismissed' && type === 'peek' && (
            <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
              The Peek will be restored only when its automated processing succeeded and its parent remains publicly eligible.
            </p>
          )}
          <div>
            <Label htmlFor="report-notes">Decision notes</Label>
            <Textarea
              id="report-notes"
              className="mt-1"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              placeholder="Explain this safety decision"
            />
          </div>
          <Button
            variant={decision?.status === 'actioned' ? 'destructive' : 'default'}
            disabled={notes.trim().length < 3 || mutation.isPending}
            onClick={() => mutation.mutate({ reportId: decision.report.report_id, status: decision.status, notes })}
          >
            {mutation.isPending ? 'Saving…' : 'Confirm decision'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportCard({ report, onDecision }) {
  const actionable = ['pending', 'reviewed'].includes(report.status);
  const type = targetType(report);
  const path = parentPath(report);
  const targetLabel = type === 'peek' ? 'Peek' : type === 'message' ? 'Message' : report.listing_type;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{report.listing_title || 'Removed target'}</p>
              <Badge variant="outline">{targetLabel}</Badge>
              <Badge variant={severeReasons.has(report.reason) ? 'destructive' : 'secondary'}>
                {reasonLabels[report.reason] || report.reason}
              </Badge>
              <Badge>{report.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Reported by {report.reporter_email} · {new Date(report.created_at).toLocaleString()}
            </p>
            {type === 'peek' && (
              <p className="text-xs text-muted-foreground">
                Peek state: {report.tour_status || 'removed'} · reporter Peek reports in 24h: {Number(report.reporter_tour_reports_24h || 0)}
              </p>
            )}
            {report.description && <p className="rounded-lg bg-muted/40 p-3 text-sm">{report.description}</p>}
            {report.admin_notes && <p className="text-sm text-muted-foreground">Admin note: {report.admin_notes}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-2">
            {path && (
              <Button asChild size="sm" variant="outline">
                <Link to={path} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />View parent
                </Link>
              </Button>
            )}
            {actionable && (
              <>
                <Button size="sm" variant="outline" onClick={() => onDecision(report, 'reviewed')}>Mark reviewed</Button>
                <Button size="sm" variant="outline" onClick={() => onDecision(report, 'dismissed')}>
                  {type === 'peek' ? 'Restore Peek' : 'Dismiss'}
                </Button>
                {(report.target_id || type === 'message') && (
                  <Button size="sm" variant="destructive" onClick={() => onDecision(report, 'actioned')}>
                    {type === 'message' ? 'Close conversation' : type === 'peek' ? 'Remove Peek' : 'Remove item'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
