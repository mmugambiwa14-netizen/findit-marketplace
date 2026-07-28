import { useState } from "react";
import { ChevronDown, ArrowLeft, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const FAQS = [
  {
    question: "How do I contact a seller?",
    answer: "Open a published listing and use the available contact actions. You can call, use WhatsApp, or email when the seller permits it. Registered users will also be able to send a plain-text FindIt message once messaging has completed migration."
  },
  {
    question: "Is it free to create listings?",
    answer: "Yes. FindIt V1 is free to browse, contact, and post within reasonable anti-abuse limits. There are no premium packages or paid placement in Version 1."
  },
  {
    question: "How long do listings stay active?",
    answer: "Listings remain active until you pause, remove, mark unavailable, sell, or rent them. Routine expiry is not enabled for the V1 launch."
  },
  {
    question: "Can I edit my listing after publishing?",
    answer: "Yes! Go to 'My Listings' from your profile, select the listing you want to edit, and click the edit button to make changes."
  },
  {
    question: "How do I save listings for later?",
    answer: "Select the heart on a listing card or detail page. Your saved items appear in Favourites. You need to sign in so they remain available across visits."
  },
  {
    question: "Does FindIt process payments?",
    answer: "No. FindIt V1 helps buyers evaluate offers and contact sellers, but it does not collect payments, hold funds, provide escrow, or guarantee a transaction. Never send money before you are satisfied that an offer is genuine."
  },
  {
    question: "How do I report a suspicious listing?",
    answer: "Use Report on the listing or seller page, choose the closest reason, and provide useful details. Reports are reviewed as quickly as the founder can safely assess them; FindIt does not promise emergency response."
  },
  {
    question: "Does FindIt verify sellers or businesses?",
    answer: "No. Identity, document, business, and dealer verification are not part of Version 1. An email-confirmed account only proves control of that email address. Always evaluate the listing and seller yourself."
  },
  {
    question: "What notifications will I receive?",
    answer: "FindIt V1 limits notifications to important operational events such as publication, listing availability changes, report resolution, and account suspension or restoration. It does not send price-drop or marketing alerts."
  },
  {
    question: "How do I delete my listing?",
    answer: "Navigate to 'My Listings', select the listing, and click the delete button. This action is permanent and cannot be undone."
  },
  {
    question: "How do I search for specific items?",
    answer: "Use the search bar at the top of the homepage. You can filter by category, location, price range, and other criteria to find exactly what you're looking for."
  },
  {
    question: "What is the verification process for sellers?",
    answer: "There is no seller-document verification process in Version 1. FindIt does not collect identity or company-registration documents and does not display a generic verified-seller badge."
  },
  {
    question: "Can I negotiate prices with sellers?",
    answer: "Yes! Many listings are marked as 'Negotiable'. Contact the seller directly through call or WhatsApp to discuss pricing. Always follow safety guidelines when meeting."
  },
  {
    question: "How do I stay safe when buying?",
    answer: "Meet in public places, bring a friend, inspect items before paying, and trust your instincts. Never share personal financial information. Report suspicious listings immediately."
  },
  {
    question: "What happens when my listing expires?",
    answer: "Routine listing expiry is disabled for the V1 launch. If expiry is enabled later, expired listings will be hidden from public search until renewed."
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
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
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

  const handleToggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Help &amp; Safety</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-3 max-w-3xl mx-auto">
        {FAQS.map((faq, index) => (
          <FAQItem
            key={faq.question}
            index={index}
            question={faq.question}
            answer={faq.answer}
            isOpen={openIndex === index}
            onToggle={() => handleToggle(index)}
          />
        ))}
        <div className="pt-5 text-center">
          <Button type="button" className="gap-2" onClick={() => navigate('/help/contact')}>
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Contact Support
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Send a structured request to the FindIt founder inbox. No attachments are accepted.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          If you are in immediate danger or believe a crime is taking place,
          contact the appropriate local emergency or law-enforcement service.
        </p>
      </div>
    </div>
  );
}
