import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

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
      params.set('country', LAUNCH_COUNTRY_CODE);
      if (location.state) params.set('province', location.state);
    }
    navigate(`/search${params.size ? `?${params.toString()}` : ''}`);
  };

  return (
    <form onSubmit={submit} className="group relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden="true" />
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search properties, cars, services..."
        aria-label="Search FindIt"
        maxLength={100}
        className="locked-control h-14 rounded-[1.15rem] border-border/85 bg-card/80 pl-11 pr-4 text-sm placeholder:text-muted-foreground/80 sm:pr-28"
      />
      <button type="submit" className="clay-button absolute right-2 top-2 hidden h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold sm:flex">
        Search
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}
