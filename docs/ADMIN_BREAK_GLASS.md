# Admin authorization and break-glass recovery

PeekaListing administration is intentionally fail-closed. A browser user is
an administrator only when the database-side role, founder authorization and
fresh MFA assurance all pass. The founder authorization is not a client-side
email check and must not be recreated in frontend code.

## Normal administration

- Use the designated founder account.
- Keep MFA enrolled and require an AAL2 session before opening `/admin`.
- Use the admin UI for moderation, reports, support, user status and taxonomy
  changes so each action is written to the audit trail.
- Never grant `super_admin` or edit role/status fields through the browser.

## Break-glass recovery

If the founder account or its MFA factor is unavailable, recovery requires the
Supabase project owner or an approved database operator with a controlled
`postgres` session. There is no browser-side bypass. The operator should:

1. Confirm the incident and record the operator, time and reason outside the
   application.
2. Use the provider's protected SQL console or a short-lived administrative
   connection; do not place credentials in source, CI logs or client
   environment variables.
3. Apply a reviewed migration to change the founder authorization or restore
   the account/MFA factor. Do not directly weaken RLS or add a permanent
   service-role path.
4. Verify an AAL2 admin session and one audited, non-destructive action.
5. Revoke the temporary access and record the recovery evidence.

Delegated moderation is not enabled by default. Introducing it is a product
and ownership decision that should use an auditable admin-grant table and the
same MFA requirement rather than weakening the founder lock.
