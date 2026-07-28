import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LEGAL_REVIEW_DATE, legalDocuments } from '@/lib/legalContent';

export default function LegalPage() {
  const { document } = useParams();
  const policy = legalDocuments[document];

  if (!policy) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Policy not found</h1>
        <Button asChild className="mt-5">
          <Link to="/">Return home</Link>
        </Button>
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to FindIt
      </Link>

      <header className="mt-7 border-b border-border pb-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-primary">FindIt legal</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{policy.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{policy.summary}</p>
        <p className="mt-4 text-xs text-muted-foreground">Draft reviewed {LEGAL_REVIEW_DATE}</p>
      </header>

      <aside className="my-8 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <p>
          <strong>Review draft:</strong> this document provides a practical launch baseline, not legal advice.
          Operator details, governing law, retention periods, and country-specific requirements must be approved before public launch.
        </p>
      </aside>

      <div className="space-y-10">
        {policy.sections.map((section) => (
          <section key={section.title} aria-labelledby={`section-${section.title.replace(/\W+/g, '-').toLowerCase()}`}>
            <h2 id={`section-${section.title.replace(/\W+/g, '-').toLowerCase()}`} className="text-xl font-bold tracking-tight">
              {section.title}
            </h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-3 space-y-2 pl-5 text-sm leading-7 text-muted-foreground sm:text-base">
                {section.bullets.map((item) => <li key={item} className="list-disc">{item}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border bg-card p-5">
        <h2 className="font-bold">Questions or data requests?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the structured support form. Do not send passwords, payment details, or identity documents.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/help/contact">Contact Support</Link>
        </Button>
      </div>
    </article>
  );
}
