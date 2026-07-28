import React from "react";
import { Link } from "react-router-dom";

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
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 block text-center text-xl font-black tracking-tight" aria-label="FindIt home">
          FIND<span className="text-primary">it</span>
        </Link>
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
      </main>
      <div className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
        <Link to="/legal/privacy" className="mx-2 hover:text-foreground hover:underline">Privacy</Link>
        <Link to="/legal/data-protection" className="mx-2 hover:text-foreground hover:underline">Data protection</Link>
        <Link to="/legal/terms" className="mx-2 hover:text-foreground hover:underline">Terms</Link>
        <Link to="/legal/cookies" className="mx-2 hover:text-foreground hover:underline">Cookies</Link>
      </div>
    </div>
  );
}
