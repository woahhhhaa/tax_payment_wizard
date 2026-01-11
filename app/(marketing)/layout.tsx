import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-220px] h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)_/_0.20),transparent_65%)]" />
        <div className="absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] bg-[linear-gradient(to_bottom,hsl(var(--foreground)_/_0.04)_1px,transparent_1px),linear-gradient(to_right,hsl(var(--foreground)_/_0.04)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <header className="sticky top-0 z-50 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
              <span className="text-sm font-semibold tracking-tight">TP</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Tax Payment Wizard</p>
              <p className="text-xs text-muted-foreground">Schedules, drafts, confirmations</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/#features">Features</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/#workflow">Workflow</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/#security">Security</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>

      <footer className="border-t bg-background/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Built for calm, repeatable tax workflows.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link className="hover:text-foreground" href="/#security">
              Security
            </Link>
            <Link className="hover:text-foreground" href="/#features">
              Features
            </Link>
            <Link className="hover:text-foreground" href="/login">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

