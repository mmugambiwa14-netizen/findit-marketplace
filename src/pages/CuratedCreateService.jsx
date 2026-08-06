import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BusinessPublishingGate, { usePublishingAccess } from '@/components/business/BusinessPublishingGate';
import CreateService from '@/pages/CreateService';

function ApprovedServicePublisher() {
  const publishing = usePublishingAccess();
  const approved = publishing?.access?.approvedCategories?.includes('service');

  if (approved) return <CreateService />;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
      <section className="clay-card w-full rounded-2xl p-6 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl font-black">Services publishing is not approved</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your business may publish only in categories approved by PeekaListing. Approval in Property, Cars or Machinery does not grant permission to publish Services.
        </p>
        <Button className="mt-5" asChild><Link to="/post">Return to approved categories</Link></Button>
      </section>
    </main>
  );
}

export default function CuratedCreateService() {
  return (
    <BusinessPublishingGate>
      <ApprovedServicePublisher />
    </BusinessPublishingGate>
  );
}
