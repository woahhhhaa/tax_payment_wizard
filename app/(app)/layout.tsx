import type { ReactNode } from "react";
import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { SignOutButton } from "./app/SignOutButton";
import { AppNav } from "./AppNav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/app" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
                <span className="text-xs font-semibold tracking-tight">TP</span>
              </div>
              <span className="hidden text-sm font-semibold sm:inline">Tax Payment Wizard</span>
            </Link>

            <AppNav />
          </div>

          <div className="flex items-center gap-3">
            {session?.user?.email ? (
              <span className="hidden text-sm text-muted-foreground md:inline">{session.user.email}</span>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
