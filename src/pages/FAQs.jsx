import { useState } from "react";
import { ChevronDown, ArrowLeft, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { goBackOrHome } from "@/lib/navigation";

const FAQS = [
  {
    question: "How do I contact a seller?",
    answer: "Open a published listing and use the available contact actions. You can call, use WhatsApp, email, or start a PeekaListing chat when the seller permits that channel."
  },
  {
    question: "Is it free to create listings?",
    answer: "Yes. PeekaListing is free to browse, contact, and post within reasonable anti-abuse limits. There are no premium packages or paid placement in this MVP."
  },
  {
    question: "How long do listings stay active?",
    answer: "Listings remain active until you pause, remove, mark unavailable, sell, or rent them. Routine expiry is not enabled for the MVP launch."
  },
  {
    question: "Can I edit my listing after publishing?",
    answer: "Yes. Go to My Listings from your profile, choose the listing, and edit its details or validated images. Valid edits remain live without a routine review queue."
  },
  {
    question: "How do I save listings for later?",
    answer: "Select the heart on a listing or service card or detail page. Your saved items appear in Saved. Sign in so they remain available across visits."
  },
  {
    question: "Does PeekaListing process payments?",
    answer: "No. PeekaListing helps buyers evaluate offers and contact sellers, but it does not collect payments, hold funds, provide escrow, or guarantee a transaction. Never send money before you are satisfied that an offer is genuine."
  },
  {
    question: "How do I report suspicious content?",
    answer: "Use Report on a listing, Peek, message, service, or seller surface, choose the closest reason, and provide useful details. Reports support post-publication safety action; PeekaListing does not promise emergency response."
  },
  {
    question: "Does PeekaListing verify businesses?",
    answer: "Eligible businesses can apply for category-specific verification. An approved business marker reflects the approved business category only; it is not a guarantee of every listing, seller claim, transaction, or item condition."
  },
  {
    question: "Are ordinary listings and Peeks manually approved?",
    answer: "No. Validated listings publish immediately, and Peeks publish automatically after successful media processing. Reported content can later be suspended, removed, or restored through the safety process."
  },
  {
    question: "What notifications will I receive?",
    answer: "PeekaListing sends important operational updates such as business decisions, Peek requests and results, messages, report outcomes, and account-status changes. Marketing alerts are not part of this MVP."
  },
  {
    question: "How do I delete my listing?",
    answer: "Navigate to My Listings, select the listing, and choose delete. This action is permanent and cannot be undone."
  },
  {
    question: "How do I search for specific items?",
    answer: "Use the search bar on Discover. You can filter by category, location, price range, and category-specific details."
  },
  {
    question: "Can I negotiate prices with sellers?",
    answer: "Many listings are marked as negotiable. Contact the seller through an available channel to discuss pricing, and follow the safety guidance before meeting or paying."
  },
  {
    question: "How do I stay safe when buying?",
    answer: "Use Peeks when available, meet in public places, bring someone you trust, inspect items before paying, and never share sensitive financial credentials. Report suspicious activity promptly."
  }
];

function FAQItem({ question, answer, isOpen, onToggle, index }) {
  const triggerId = `faq-trigger-${index}`;
  const panelId = `faq-panel-${index}`;
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-medium">{question}</span>
        <ChevronDown
          aria-hidden="true"
          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div id={panelId} role="region" aria-labelledby={triggerId} className="px-4 pb-4 pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQs() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" aria-label="Go back" onClick={() => goBackOrHome(navigate, '/') }>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Help &amp; Safety</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-3 max-w-3xl mx-auto">
        {FAQS.map((faq, index) => (
          <FAQItem
            key={faq.question}
            index={index}
            question={faq.question}
            answer={faq.answer}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
        <div className="pt-5 text-center">
          <Button type="button" className="gap-2" onClick={() => navigate('/help/contact')}>
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Contact Support
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Send a structured request to the PeekaListing support inbox. No attachments are accepted.
          </p>
        </div>
      </div>

      <div className="px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          If you are in immediate danger or believe a crime is taking place,
          contact the appropriate local emergency or law-enforcement service.
        </p>
      </div>
    </div>
  );
}
