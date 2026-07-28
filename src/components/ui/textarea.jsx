import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>} */
  (({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-input bg-surface-secondary px-3.5 py-3 text-base text-foreground shadow-sm transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  )),
);
Textarea.displayName = "Textarea";

export { Textarea };
