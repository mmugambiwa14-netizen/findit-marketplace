import { useState } from 'react';
import { Building2, Loader2, Search, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchBusinessAccounts } from '@/services/adminBusinessPublishingService';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS = Object.freeze({
  property: 'Property',
  car: 'Cars',
  machinery: 'Machinery',
  service: 'Services',
});

function categoryList(categories) {
  return (categories || []).map((category) => CATEGORY_LABELS[category] || category).join(', ');
}

/**
 * Finds the account an admin is acting for and shows the publishing standing it
 * already holds, so an operator can see that a business is approved for Cars
 * before onboarding it again or publishing against a category it does not have.
 */
export default function BusinessAccountPicker({
  selected,
  onSelect,
  label = 'Find the account',
  description = 'Search by email address or name.',
  inputId = 'business-account-search',
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    setError('');
    setSearching(true);
    try {
      const rows = await searchBusinessAccounts(term);
      setResults(rows);
      if (rows.length === 0) setError('No account matches that search.');
    } catch (failure) {
      setResults(null);
      setError(failure.message || 'Accounts could not be searched.');
    } finally {
      setSearching(false);
    }
  };

  const submitOnEnter = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void search();
  };

  if (selected) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="truncate font-bold">{selected.fullName || selected.email}</p>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{selected.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.approvedCategories.length > 0
                ? `Approved to publish: ${categoryList(selected.approvedCategories)}`
                : 'No publishing categories approved yet'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onSelect(null)}>Change account</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={inputId}>{label}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={submitOnEnter}
          placeholder="dealer@example.com"
          autoComplete="off"
        />
        <Button onClick={search} disabled={searching || term.trim().length < 2}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-1">Search</span>
        </Button>
      </div>

      {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      {results && results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((account) => {
            const inactive = account.accountStatus !== 'active';
            return (
              <li key={account.userId}>
                <button
                  type="button"
                  onClick={() => onSelect(account)}
                  disabled={inactive}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors',
                    inactive ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/50',
                  )}
                >
                  <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{account.fullName || account.email}</span>
                    <span className="block truncate text-sm text-muted-foreground">{account.email}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {inactive ? `Account ${account.accountStatus}` : null}
                      {inactive && account.approvedCategories.length > 0 ? ' · ' : null}
                      {account.approvedCategories.length > 0
                        ? `Approved: ${categoryList(account.approvedCategories)}`
                        : null}
                      {!inactive && account.approvedCategories.length === 0
                        ? `Application: ${String(account.applicationStatus).replace(/_/g, ' ')}`
                        : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
