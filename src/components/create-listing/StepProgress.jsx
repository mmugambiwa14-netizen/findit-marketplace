const STEPS = ['Category', 'Details', 'Location', 'Photos & contact', 'Review'];

export default function StepProgress({ currentStep, onSaveDraft }) {
  const percent = Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100);
  return <div className="sticky top-0 z-40 border-b border-border/60 bg-card/95 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[680px] items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{currentStep}</span><span className="text-xs font-medium text-muted-foreground">of {STEPS.length} · <span className="font-semibold text-foreground">{STEPS[currentStep - 1]}</span></span></div>
      <button type="button" onClick={onSaveDraft} className="min-h-11 px-2 text-xs font-semibold text-primary hover:underline">Save draft</button>
    </div>
    <div className="mx-auto mb-2.5 h-1.5 max-w-[648px] overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} /></div>
  </div>;
}
