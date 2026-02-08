"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/payments", label: "Payments" },
  { href: "/wizard", label: "Batch Studio" }
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/app"
            ? pathname === "/app"
            : item.href === "/wizard"
              ? pathname === "/wizard"
              : pathname.startsWith(item.href);

        return (
          <Button
            key={item.href}
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              isActive && "bg-muted text-foreground hover:bg-muted"
            )}
          >
            <Link href={item.href}>{item.label}</Link>
          </Button>
        );
      })}
    </nav>
  );
}
