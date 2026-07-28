import { ChevronDown, Clapperboard } from 'lucide-react';

const GUIDES = {
  property: 'Show the exterior, main rooms, kitchen, bathrooms and outdoor space. Move slowly and keep each room well lit.',
  car: 'Show all sides, interior, dashboard, engine start, boot and any visible damage. Do not hide warning lights or defects.',
  machinery: 'Show the whole machine, controls, start-up, operation and visible wear. Record from a safe distance.',
  service: 'Show your work, equipment, completed results or working environment. Do not include unrelated people without permission.',
};

function guideKey(category, parentType) {
  if (parentType === 'service') return 'service';
  if (category === 'vehicle' || category === 'vehicles') return 'car';
  if (category === 'equipment' || category === 'heavy_equipment') return 'machinery';
  return GUIDES[category] ? category : 'property';
}

export default function TourRecordingGuide({ category, parentType = 'listing' }) {
  const guidance = GUIDES[guideKey(category, parentType)];
  return (
    <details className="group rounded-xl border border-border bg-muted/15">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="flex items-center gap-2"><Clapperboard className="h-4 w-4 text-primary" />How to record a useful Tour</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">{guidance}</p>
    </details>
  );
}
