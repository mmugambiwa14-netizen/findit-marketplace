import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { startListingConversation } from '@/services/messagingService';
import { userFacingError } from '@/lib/userFacingErrors';

export default function MessageDialog({ open, onClose, listing, type }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState('');
  const mutation = useMutation(/** @type {import('@tanstack/react-query').UseMutationOptions<string, Error, string>} */ ({
    mutationFn: (body) => startListingConversation(listing.id, body),
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['message-inbox'] });
      setMessage('');
      setSendError('');
      onClose();
      navigate(`/chats/${conversationId}`);
    },
    onError: (error) => {
      const nextError = userFacingError(error?.cause ?? error, 'We could not send your message. Please try again.');
      setSendError(nextError);
      toast.error(nextError);
    },
  }));

  const submitMessage = (event) => {
    event.preventDefault();
    const body = message.trim();
    if (!body) {
      setSendError('Write a message before sending.');
      return;
    }
    if (mutation.isPending) return;
    setSendError('');
    mutation.mutate(body);
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && !mutation.isPending) { setMessage(''); setSendError(''); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Message seller</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">About <span className="font-medium text-foreground">{listing.title}</span></p>
        <form onSubmit={submitMessage} noValidate className="space-y-4">
          <div className="space-y-2"><Label htmlFor="initial-listing-message">Message</Label><Textarea id="initial-listing-message" rows={5} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Hi, I'm interested in this ${type === 'property' ? 'property' : type === 'car' ? 'vehicle' : 'equipment'}. Is it still available?`} /></div>
          <p className="text-xs text-muted-foreground">Plain text only. Do not share passwords, PINs, or payment codes.</p>
          {sendError && <p role="alert" className="text-sm font-medium text-destructive">{sendError}</p>}
          <Button type="button" onClick={submitMessage} className="min-h-11" disabled={mutation.isPending}>{mutation.isPending ? 'Sending…' : <><Send className="mr-2 h-4 w-4" />Send message</>}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
