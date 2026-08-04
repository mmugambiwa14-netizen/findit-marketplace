import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--findit-control-radius)] text-[var(--findit-control-text)] font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:h-[var(--findit-icon-size)] [&_svg]:w-[var(--findit-icon-size)] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-border-strong bg-card/60 text-foreground hover:border-primary/45 hover:bg-surface-raised",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-surface-raised",
        ghost: "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
        link: "min-h-0 rounded-none px-0 text-primary underline-offset-4 hover:text-primary-hover hover:underline",
      },
      size: {
        default: "h-[var(--findit-control-height)] px-4 py-2.5",
        sm: "h-[var(--findit-control-height-sm)] rounded-[var(--findit-control-radius-sm)] px-3 text-xs",
        lg: "h-[var(--findit-control-height-lg)] px-6 text-base",
        icon: "h-[var(--findit-icon-button-size)] w-[var(--findit-icon-button-size)] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * @typedef {React.ButtonHTMLAttributes<HTMLButtonElement> & {
 *   asChild?: boolean,
 *   variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link",
 *   size?: "default" | "sm" | "lg" | "icon"
 * }} ButtonProps
 */

const Button = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<HTMLButtonElement, ButtonProps>} */
  (({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        {...props}
      />
    );
  }),
);
Button.displayName = "Button";

export { Button, buttonVariants };
