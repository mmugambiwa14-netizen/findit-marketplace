import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/AuthContext';
import { submitSupportRequest } from '@/services/contactSupportService';

const CATEGORIES = [
  ['account', 'Account access'],
  ['listing', 'Listing or service advert'],
  ['report', 'Report or moderation decision'],
  ['safety', 'Safety concern'],
  ['technical', 'Technical problem'],
  ['other', 'Something else'],
];

export default function ContactSupport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    category: '',
    contactEmail: '',
    message: '',
    relatedReference: '',
  });
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    if (user?.email) {
      setForm((current) => current.contactEmail
        ? current
        : { ...current, contactEmail: user.email });
    }
  }, [user?.email]);

  const mutation = useMutation({
    mutationFn: submitSupportRequest,
    onSuccess: setConfirmation,
  });

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (mutation.error) mutation.reset();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    mutation.mutate(form);
  };

  if (confirmation) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <Card className="mx-auto max-w-xl">
          <CardContent className="space-y-5 pt-8 text-center" aria-live="polite">
            <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-600" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-semibold">Your request was received</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Save this reference in case you need to contact us again.
              </p>
            </div>
            <p className="rounded-lg bg-muted px-4 py-3 font-mono text-base font-semibold">
              {confirmation.referenceId}
            </p>
            <p className="text-sm text-muted-foreground">
              FindIt is operated by a small team. Safety issues are prioritised, but this is not an emergency service.
            </p>
            <Button onClick={() => navigate('/help')}>Back to Help &amp; Safety</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" className="mb-3 -ml-2 gap-2" onClick={() => navigate('/help')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Help &amp; Safety
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Contact Support</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tell us what happened and include the most useful details. Do not send passwords, payment details, or identity documents.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="support-category">What do you need help with?</Label>
                <Select value={form.category} onValueChange={(value) => update('category', value)}>
                  <SelectTrigger id="support-category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-email">Contact email</Label>
                <Input
                  id="support-email"
                  type="email"
                  autoComplete="email"
                  value={form.contactEmail}
                  onChange={(event) => update('contactEmail', event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-reference">Listing or report reference <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                  id="support-reference"
                  value={form.relatedReference}
                  onChange={(event) => update('relatedReference', event.target.value)}
                  maxLength={120}
                  placeholder="Listing link, report ID, or existing reference"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="support-message">Message</Label>
                  <span className="text-xs text-muted-foreground">{form.message.trim().length}/4000</span>
                </div>
                <Textarea
                  id="support-message"
                  className="min-h-36"
                  value={form.message}
                  onChange={(event) => update('message', event.target.value)}
                  minLength={20}
                  maxLength={4000}
                  placeholder="Describe the problem, what you expected, and what happened."
                  required
                />
              </div>
              {mutation.error && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {mutation.error.message}
                </p>
              )}
              <Button type="submit" className="w-full sm:w-auto" disabled={mutation.isPending}>
                {mutation.isPending ? 'Sending…' : 'Send support request'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Requests are rate-limited to protect the support inbox. If you are in immediate danger, contact the appropriate local emergency or law-enforcement service.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
