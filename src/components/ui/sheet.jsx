"use client";
import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority";
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef(
  /**
   * @param {React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>} props
   * @param {React.ForwardedRef<React.ElementRef<typeof SheetPrimitive.Overlay>>} ref
   */
  ({ className, ...props }, ref) => (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
      ref={ref}
    />
  ),
)
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 overflow-y-auto border-border-strong bg-card p-5 shadow-floating transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 max-h-[92dvh] rounded-b-3xl border-b pt-[max(1.25rem,env(safe-area-inset-top))] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl border-t pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-[100dvh] w-[min(88vw,24rem)] border-r pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-[100dvh] w-[min(88vw,24rem)] border-l pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: { side: "right" },
  },
)

/** @typedef {React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & import("class-variance-authority").VariantProps<typeof sheetVariants>} SheetContentProps */

const SheetContent = React.forwardRef(
  /**
   * @param {SheetContentProps} props
   * @param {React.ForwardedRef<React.ElementRef<typeof SheetPrimitive.Content>>} ref
   */
  ({ side = "right", className, children, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        <SheetPrimitive.Close
          className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full bg-card/80 text-muted-foreground opacity-90 shadow-sm ring-offset-background backdrop-blur-md transition hover:text-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  ),
)
SheetContent.displayName = SheetPrimitive.Content.displayName

/** @param {React.HTMLAttributes<HTMLDivElement>} props */
const SheetHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-2 pr-12 text-center sm:text-left", className)} {...props} />
)
SheetHeader.displayName = "SheetHeader"

/** @param {React.HTMLAttributes<HTMLDivElement>} props */
const SheetFooter = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef(
  /**
   * @param {React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>} props
   * @param {React.ForwardedRef<React.ElementRef<typeof SheetPrimitive.Title>>} ref
   */
  ({ className, ...props }, ref) => (
    <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
  ),
)
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef(
  /**
   * @param {React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>} props
   * @param {React.ForwardedRef<React.ElementRef<typeof SheetPrimitive.Description>>} ref
   */
  ({ className, ...props }, ref) => (
    <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
SheetDescription.displayName = SheetPrimitive.Description.displayName

export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
