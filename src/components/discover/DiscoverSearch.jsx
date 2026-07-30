import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function DiscoverSearch({ location }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const value = query.trim().slice(0, 100);
    const params = new URLSearchParams();
    if (value) params.set('q', value);
    if (location?.city) {
      params.set('location', location.city);
      if (location.cityName) params.set('locationName', location.cityName);
      if (location.country) params.set('country', location.country);
      if (location.state) params.set('province', location.state);
    }
    navigate(`/search${params.size ? `?${params.toString()}` : ''}`);
  };

  return (
    <form onSubmit={submit} className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search listings, services or locations"
        aria-label="Search FindIt"
        maxLength={100}
        className="h-14 rounded-2xl border-border bg-card pl-12 pr-4 text-sm shadow-card transition-colors focus-visible:bg-surface-secondary sm:text-base"
      />
    </form>
  );
}
