import type { ReactNode } from "react";
import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { SignOutButton } from "./app/SignOutButton";
import { AppSidebar } from "./AppSidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r bg-card/40 lg:block">
          <AppSidebar userEmail={session?.user?.email} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/app" className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
                  <span className="text-xs font-semibold tracking-tight">TP</span>
                </div>
                <span className="text-sm font-semibold">Tax Payment Wizard</span>
              </Link>

              <div className="flex items-center gap-2">
                <SignOutButton />
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
