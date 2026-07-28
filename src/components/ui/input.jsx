import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>} */
  (({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-surface-secondary px-3.5 py-2 text-base text-foreground shadow-sm transition-[border-color,box-shadow,background-color] file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  )),
);
Input.displayName = "Input";

export { Input };
