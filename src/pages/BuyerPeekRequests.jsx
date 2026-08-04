import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BuyerPeekRequestsQueue from '@/components/peekThreads/BuyerPeekRequestsQueue';
import ResponsePeekBindingQueue from '@/components/peekThreads/ResponsePeekBindingQueue';

export default function BuyerPeekRequests() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] pb-24">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={() => navigate(-1)} className="p-1" aria-label="Go back"><ArrowLeft className="h-5 w-5" /></button>
        <div>
          <h1 className="text-lg font-bold">Buyer Peek Requests</h1>
          <p className="text-xs text-muted-foreground">Visual evidence buyers want from your listings</p>
        </div>
      </header>
      <div className="pt-4">
        <ResponsePeekBindingQueue />
        <BuyerPeekRequestsQueue />
      </div>
    </div>
  );
}
