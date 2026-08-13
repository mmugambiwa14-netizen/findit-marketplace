// Compatibility entry point for legacy imports. The routed admin support
// page is the single supported implementation so filters, pagination,
// loading states, and audit invalidation cannot drift between two inboxes.
export { default } from '@/pages/admin/AdminSupportRequests';
