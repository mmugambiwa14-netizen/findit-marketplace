const STEPS = ['Category', 'Details', 'Location', 'Media & contact', 'Review'];

export default function StepProgress({ currentStep, onSaveDraft }) {
  const percent = Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100);
  return (
    <header className="locked-page-header">
      <div className="mx-auto flex max-w-[680px] items-center justify-between px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Post</p>
          <h1 className="mt-0.5 text-base font-extrabold">{STEPS[currentStep - 1]}</h1>
        </div>
        <button type="button" onClick={onSaveDraft} className="min-h-11 rounded-xl px-3 text-xs font-bold text-primary hover:bg-primary/8">Save draft</button>
      </div>
      <div className="mx-auto flex max-w-[680px] items-center gap-2 px-4 pb-3" aria-label={`Step ${currentStep} of ${STEPS.length}`}>
        {STEPS.map((label, index) => {
          const step = index + 1;
          const active = step === currentStep;
          const complete = step < currentStep;
          return <span key={label} className={`h-1.5 flex-1 rounded-full ${active || complete ? 'bg-primary' : 'bg-muted'}`} aria-hidden="true" />;
        })}
        <span className="ml-1 text-[10px] font-semibold text-muted-foreground">{percent}%</span>
      </div>
    </header>
  );
}
