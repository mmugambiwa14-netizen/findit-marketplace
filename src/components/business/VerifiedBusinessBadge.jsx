import { BadgeCheck, Clock3, ShieldAlert } from 'lucide-react';

const STATES = {
  approved: { icon: BadgeCheck, label: 'Approved business', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  pending: { icon: Clock3, label: 'Approval pending', className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  rejected: { icon: ShieldAlert, label: 'Approval not granted', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
};

export default function VerifiedBusinessBadge({ verified = false, status = 'none', publicView = false }) {
  const normalized = verified ? 'approved' : status;
  if (publicView && normalized !== 'approved') return null;
  const state = STATES[normalized];
  if (!state) return null;
  const Icon = state.icon;
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${state.className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {state.label}
    </span>
  );
}
