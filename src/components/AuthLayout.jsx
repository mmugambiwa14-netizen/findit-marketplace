import React from "react";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";

/**
 * @param {{
 *   icon: React.ComponentType<any>,
 *   title: string,
 *   subtitle?: string,
 *   footer?: React.ReactNode,
 *   children: React.ReactNode
 * }} props
 */
export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="findit-auth-shell relative flex min-h-[100dvh] flex-col overflow-hidden bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 flex justify-center" aria-label="PeekaListing home">
            <BrandLogo markClassName="h-10 w-10" wordmarkClassName="text-2xl tracking-[-0.04em]" />
          </Link>
          <div className="mb-6 text-center">
            <div className="clay-button mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl">
              <Icon className="h-7 w-7 text-primary-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-black tracking-[-0.035em] text-foreground">{title}</h1>
            {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="clay-card rounded-[1.5rem] p-6 sm:p-8">
            {children}
          </div>
          {footer && (
            <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
          )}
        </div>
      </main>
      <div className="border-t border-border/70 bg-background/55 px-4 py-4 text-center text-xs text-muted-foreground backdrop-blur-xl">
        <Link to="/legal/privacy" className="mx-2 hover:text-foreground hover:underline">Privacy</Link>
        <Link to="/legal/data-protection" className="mx-2 hover:text-foreground hover:underline">Data protection</Link>
        <Link to="/legal/terms" className="mx-2 hover:text-foreground hover:underline">Terms</Link>
        <Link to="/legal/cookies" className="mx-2 hover:text-foreground hover:underline">Cookies</Link>
      </div>
    </div>
  );
}
