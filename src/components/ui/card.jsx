import * as React from "react";

import { cn } from "@/lib/utils";

/** @typedef {React.HTMLAttributes<HTMLDivElement>} DivProps */

const Card = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLDivElement, DivProps>} */
  (({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-2xl border border-border bg-card text-card-foreground shadow-card", className)}
      {...props}
    />
  )),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLDivElement, DivProps>} */
  (({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5 sm:p-6", className)} {...props} />
  )),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLDivElement, DivProps>} */
  (({ className, ...props }, ref) => (
    <div ref={ref} className={cn("font-semibold leading-tight tracking-tight", className)} {...props} />
  )),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLDivElement, DivProps>} */
  (({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />
  )),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLDivElement, DivProps>} */
  (({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
  )),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLDivElement, DivProps>} */
  (({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
  )),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
