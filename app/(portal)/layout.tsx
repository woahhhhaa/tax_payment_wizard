import type { ReactNode } from "react";
import Link from "next/link";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-220px] h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)_/_0.16),transparent_70%)]" />
      </div>

      <header className="border-b bg-background/75 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
              <span className="text-xs font-semibold tracking-tight">TP</span>
            </div>
            <span className="text-sm font-semibold">Tax Payment Wizard</span>
          </Link>
          <p className="text-xs text-muted-foreground">Secure client portal</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-10">{children}</main>
    </div>
  );
}

