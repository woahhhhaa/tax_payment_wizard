"use client";

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./app/SignOutButton";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Home", icon: HomeIcon },
  { href: "/app/clients", label: "Clients", icon: UsersIcon },
  { href: "/app/payments", label: "Payments", icon: CreditCardIcon },
  { href: "/wizard", label: "Wizard", icon: SparklesIcon }
];

export function AppSidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b bg-background/60 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
              <span className="text-xs font-semibold tracking-tight">TP</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Tax Payment Wizard</p>
              <p className="text-xs text-muted-foreground">Workspace</p>
            </div>
          </Link>
        </div>

        <div className="mt-4">
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <Link href="/wizard">
              <PlusIcon className="h-4 w-4" aria-hidden />
              Create new
            </Link>
          </Button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-auto px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : item.href === "/wizard"
                ? pathname === "/wizard"
                : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                isActive && "bg-primary/10 text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground",
                  isActive && "text-primary"
                )}
                aria-hidden
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t bg-background/60 px-4 py-4">
        {userEmail ? (
          <p className="truncate text-xs text-muted-foreground" title={userEmail}>
            {userEmail}
          </p>
        ) : null}
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z" />
    </svg>
  );
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <path d="M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CreditCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h6" />
    </svg>
  );
}

function SparklesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M5 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
      <path d="M19 9l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
      <path d="M12 12l1.5 4.5L18 18l-4.5 1.5L12 24l-1.5-4.5L6 18l4.5-1.5L12 12z" />
    </svg>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
