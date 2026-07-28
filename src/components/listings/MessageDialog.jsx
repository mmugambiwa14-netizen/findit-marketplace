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

export default function MessageDialog({ open, onClose, listing, type }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: () => startListingConversation(listing.id, message),
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['message-inbox'] });
      setMessage('');
      onClose();
      navigate(`/chats/${conversationId}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && !mutation.isPending) { setMessage(''); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Message seller</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">About <span className="font-medium text-foreground">{listing.title}</span></p>
        <div className="space-y-2"><Label htmlFor="initial-listing-message">Message</Label><Textarea id="initial-listing-message" rows={5} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Hi, I'm interested in this ${type === 'property' ? 'property' : type === 'car' ? 'vehicle' : 'equipment'}. Is it still available?`} /></div>
        <p className="text-xs text-muted-foreground">Plain text only. Do not share passwords, PINs, or payment codes.</p>
        <Button type="button" className="min-h-11" disabled={!message.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Sending…' : <><Send className="mr-2 h-4 w-4" />Send message</>}</Button>
      </DialogContent>
    </Dialog>
  );
}
