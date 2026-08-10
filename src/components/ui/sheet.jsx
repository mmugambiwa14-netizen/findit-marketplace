"use client";
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { prefersReducedMotion, rubberBand, settleElement, shouldDismissDrag } from "@/lib/motionTokens";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef(
  /**
   * @param {React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>} props
   * @param {React.ForwardedRef<React.ElementRef<typeof SheetPrimitive.Overlay>>} ref
   */
  ({ className, ...props }, ref) => (
    <SheetPrimitive.Overlay
      className={cn(
        "fluid-sheet-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
      ref={ref}
    />
  ),
);
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fluid-sheet fixed z-50 gap-4 overflow-y-auto border-border-strong bg-card p-5 shadow-floating data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 max-h-[92dvh] rounded-b-3xl border-b pt-[max(1.25rem,env(safe-area-inset-top))] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[1.75rem] border-t pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-[100dvh] w-[min(88vw,24rem)] border-r pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-[100dvh] w-[min(88vw,24rem)] border-l pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: { side: "right" },
  },
);

function assignRef(ref, value) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function readTranslateY(element) {
  if (!element || typeof window === "undefined") return 0;
  const transform = window.getComputedStyle(element).transform;
  if (!transform || transform === "none") return 0;
  try {
    const Matrix = window.DOMMatrixReadOnly || window.WebKitCSSMatrix;
    if (!Matrix) return 0;
    return Number(new Matrix(transform).m42) || 0;
  } catch {
    return 0;
  }
}

/** @typedef {React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & import("class-variance-authority").VariantProps<typeof sheetVariants>} SheetContentProps */

const SheetContent = React.forwardRef(
  /**
   * @param {SheetContentProps} props
   * @param {React.ForwardedRef<React.ElementRef<typeof SheetPrimitive.Content>>} forwardedRef
   */
  ({ side = "right", className, children, style, ...props }, forwardedRef) => {
    const contentRef = React.useRef(null);
    const closeRef = React.useRef(null);
    const dragState = React.useRef(null);
    const animationRef = React.useRef(null);
    const [dragY, setDragY] = React.useState(null);
    const [dragging, setDragging] = React.useState(false);

    const setContentRef = React.useCallback((node) => {
      contentRef.current = node;
      assignRef(forwardedRef, node);
    }, [forwardedRef]);

    const cancelAnimation = React.useCallback(() => {
      animationRef.current?.cancel?.();
      animationRef.current = null;
    }, []);

    React.useEffect(() => () => cancelAnimation(), [cancelAnimation]);

    const beginDrag = (event) => {
      if (side !== "bottom" || event.button > 0) return;
      const content = contentRef.current;
      if (!content) return;

      cancelAnimation();
      const currentY = Math.max(0, readTranslateY(content));
      dragState.current = {
        pointerId: event.pointerId,
        startY: event.clientY - currentY,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        velocity: 0,
        currentY,
      };
      setDragY(currentY);
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const moveDrag = (event) => {
      const state = dragState.current;
      const content = contentRef.current;
      if (!state || !content || state.pointerId !== event.pointerId) return;
      event.preventDefault();

      const rawY = event.clientY - state.startY;
      const nextY = rawY < 0 ? rubberBand(rawY, content.offsetHeight, 0.2) : rawY;
      const deltaTime = Math.max(1, event.timeStamp - state.lastTime);
      const instantaneousVelocity = ((event.clientY - state.lastY) / deltaTime) * 1000;
      state.velocity = state.velocity * 0.35 + instantaneousVelocity * 0.65;
      state.lastY = event.clientY;
      state.lastTime = event.timeStamp;
      state.currentY = nextY;
      setDragY(nextY);
    };

    const finishDrag = (event) => {
      const state = dragState.current;
      const content = contentRef.current;
      if (!state || !content || state.pointerId !== event.pointerId) return;

      event.currentTarget.releasePointerCapture?.(event.pointerId);
      dragState.current = null;
      setDragging(false);

      const currentY = Number(state.currentY) || 0;
      const dismiss = shouldDismissDrag({
        distance: Math.max(0, currentY),
        velocity: state.velocity,
        size: content.offsetHeight,
      });

      if (prefersReducedMotion()) {
        setDragY(null);
        if (dismiss) closeRef.current?.click();
        return;
      }

      cancelAnimation();
      if (dismiss) {
        const remaining = Math.max(0, content.offsetHeight - Math.max(0, currentY));
        const velocity = Math.max(450, state.velocity);
        const duration = Math.max(120, Math.min(240, (remaining / velocity) * 1000));
        const animation = settleElement(content, [
          { transform: `translate3d(0, ${currentY}px, 0)` },
          { transform: "translate3d(0, 105%, 0)" },
        ], { duration });
        animationRef.current = animation;
        setDragY(null);
        animation?.finished
          .then(() => {
            if (animationRef.current !== animation) return;
            animationRef.current = null;
            closeRef.current?.click();
          })
          .catch(() => {});
        return;
      }

      const animation = settleElement(content, [
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ]);
      animationRef.current = animation;
      setDragY(null);
      animation?.finished
        .then(() => {
          if (animationRef.current === animation) animationRef.current = null;
        })
        .catch(() => {});
    };

    const cancelDrag = (event) => {
      const state = dragState.current;
      if (!state || state.pointerId !== event.pointerId) return;
      dragState.current = null;
      setDragging(false);
      const content = contentRef.current;
      const currentY = Number(state.currentY) || 0;
      setDragY(null);
      if (!content || prefersReducedMotion()) return;
      cancelAnimation();
      animationRef.current = settleElement(content, [
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ]);
    };

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          ref={setContentRef}
          className={cn(sheetVariants({ side }), className)}
          data-fluid-sheet-side={side}
          style={{
            overscrollBehavior: "contain",
            ...style,
            ...(dragging ? { animation: "none", transition: "none", userSelect: "none" } : null),
            ...(dragY === null ? null : { transform: `translate3d(0, ${dragY}px, 0)` }),
          }}
          {...props}
        >
          {side === "bottom" && (
            <div
              className="fluid-sheet-handle-region flex h-5 touch-none items-center justify-center"
              role="presentation"
              onPointerDown={beginDrag}
              onPointerMove={moveDrag}
              onPointerUp={finishDrag}
              onPointerCancel={cancelDrag}
            >
              <span className="fluid-sheet-handle h-1 w-9 rounded-full bg-muted-foreground/35" aria-hidden="true" />
            </div>
          )}
          <SheetPrimitive.Close
            ref={closeRef}
            className="fluid-pressable absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full bg-card/78 text-muted-foreground opacity-90 ring-offset-background backdrop-blur-xl hover:text-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary/80"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
          {children}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

/** @param {React.HTMLAttributes<HTMLDivElement>} props */
const SheetHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-2 pr-12 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

/** @param {React.HTMLAttributes<HTMLDivElement>} props */
const SheetFooter = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef(
  /**
   * @param {React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>} props
   * @param {React.ForwardedRef<React.ElementRef<typeof SheetPrimitive.Title>>} ref
   */
  ({ className, ...props }, ref) => (
    <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold tracking-[-0.015em] text-foreground", className)} {...props} />
  ),
);
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef(
  /**
   * @param {React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>} props
   * @param {React.ForwardedRef<React.ElementRef<typeof SheetPrimitive.Description>>} ref
   */
  ({ className, ...props }, ref) => (
    <SheetPrimitive.Description ref={ref} className={cn("text-sm leading-5 text-muted-foreground", className)} {...props} />
  ),
);
SheetDescription.displayName = SheetPrimitive.Description.displayName;

const FluidSheet = Sheet;
const FluidSheetContent = SheetContent;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  FluidSheet,
  FluidSheetContent,
};
