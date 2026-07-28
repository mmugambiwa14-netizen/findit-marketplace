import { Link, useLocation } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SiteFooter from '@/components/layout/SiteFooter';


export default function PageNotFound() {
    const location = useLocation();
    const pageName = location.pathname.substring(1);
    
    return (
        <div className="flex min-h-screen flex-col bg-background">
          <main className="flex flex-1 items-center justify-center px-6 py-16">
            <div className="w-full max-w-md text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <SearchX className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-primary">404</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">We couldn’t find that page</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The address “{pageName || '/'}” may be outdated or incomplete.
              </p>
              <div className="mt-7 flex justify-center gap-3">
                <Button asChild><Link to="/">Go home</Link></Button>
                <Button asChild variant="outline"><Link to="/help">Get help</Link></Button>
              </div>
            </div>
          </main>
          <SiteFooter compact />
        </div>
    )
}
