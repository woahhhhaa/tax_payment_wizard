import type { SVGProps } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type ClientStatusTab = "all" | "active" | "inactive";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isStatusTab(value: string | undefined): value is ClientStatusTab {
  return value === "all" || value === "active" || value === "inactive";
}

function activeSinceDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function clientStatus(updatedAt: Date) {
  const activeSince = activeSinceDate(90);
  return updatedAt >= activeSince ? "Active" : "Inactive";
}

function statusBadge(status: "Active" | "Inactive") {
  if (status === "Active") return <Badge variant="success">Active</Badge>;
  return <Badge variant="warning">Inactive</Badge>;
}

function formatActivity(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildHref(base: string, searchParams: SearchParams, updates: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    const first = firstParam(value);
    if (typeof first === "string" && first.length) {
      params.set(key, first);
    }
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (!value) {
      params.delete(key);
      return;
    }
    params.set(key, value);
  });

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export default async function ClientsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  const params = searchParams ?? {};

  if (!userId) {
    redirect("/login?next=/app/clients");
  }

  const q = firstParam(params.q)?.trim() || "";
  const statusParam = firstParam(params.status);
  const status = isStatusTab(statusParam) ? statusParam : "all";
  const activeSince = activeSinceDate(90);

  const where = {
    userId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { addresseeName: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(status === "active"
      ? { updatedAt: { gte: activeSince } }
      : status === "inactive"
        ? { updatedAt: { lt: activeSince } }
        : {})
  };

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      include: {
        _count: { select: { runs: true, portalLinks: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 50
    })
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Clients
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Search and manage the client records created by your wizard runs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href={buildHref("/app/clients", params, {})}>
              <DownloadIcon className="h-4 w-4" aria-hidden />
              Export
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href={buildHref("/app/clients", params, {})}>
              <UploadIcon className="h-4 w-4" aria-hidden />
              Import
            </Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/wizard">
              <PlusIcon className="h-4 w-4" aria-hidden />
              New client
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3 border-b pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Status
              </span>
              <div className="flex items-center gap-1">
                {(["all", "active", "inactive"] as const).map((tab) => (
                  <Link
                    key={tab}
                    href={buildHref("/app/clients", params, { status: tab === "all" ? "all" : tab })}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm transition-colors",
                      tab === status ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {tab === "all" ? "All" : tab === "active" ? "Active" : "Inactive"}
                  </Link>
                ))}
              </div>
            </div>

            <Separator orientation="vertical" className="hidden h-6 sm:block" />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" aria-hidden />
              Active = updated in the last 90 days
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">{total}</span>
            <span>result{total === 1 ? "" : "s"}</span>
          </div>
        </div>

        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center">
            <input type="hidden" name="status" value={status} />
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Search clients..."
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <Button type="submit" variant="secondary" className="gap-2">
              <FilterIcon className="h-4 w-4" aria-hidden />
              Filters
            </Button>
          </div>

          {total > clients.length ? (
            <p className="text-sm text-muted-foreground">
              Showing {clients.length} of {total}
            </p>
          ) : null}
        </form>
      </div>

      <Card className="overflow-hidden bg-card/70 backdrop-blur">
        <CardHeader className="py-4">
          <CardTitle className="text-base font-semibold">Client list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clients.length ? (
            <Table>
              <TableHeader className="bg-background/80 backdrop-blur">
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      aria-label="Select all"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                  </TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Entity type</TableHead>
                  <TableHead className="hidden md:table-cell">Runs</TableHead>
                  <TableHead className="hidden md:table-cell">Portal links</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const label = client.name || client.addresseeName || "Unnamed";
                  const statusLabel = clientStatus(client.updatedAt);
                  return (
                    <TableRow key={client.id} className="odd:bg-muted/15">
                      <TableCell>
                        <input
                          aria-label={`Select ${label}`}
                          type="checkbox"
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                        />
                      </TableCell>
                      <TableCell className="min-w-[260px]">
                        <div className="space-y-0.5">
                          <p className="font-medium leading-tight">{label}</p>
                          <p className="text-xs text-muted-foreground">ID {client.id.slice(0, 8)}</p>
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(statusLabel)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className={cn("text-sm", client.entityType ? "text-foreground" : "text-muted-foreground")}>
                          {client.entityType || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums">{client._count.runs}</TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums">
                        {client._count.portalLinks ? (
                          <span className="inline-flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                            {client._count.portalLinks}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatActivity(client.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          aria-label={`Actions for ${label}`}
                        >
                          <MoreIcon className="h-4 w-4" aria-hidden />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-sm font-medium">No clients found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try adjusting your search or run the wizard to create a new client.
              </p>
              <div className="mt-6 flex justify-center">
                <Button asChild className="gap-2">
                  <Link href="/wizard">
                    <PlusIcon className="h-4 w-4" aria-hidden />
                    Open wizard
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21 21l-4.3-4.3" />
      <circle cx="11" cy="11" r="7" />
    </svg>
  );
}

function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 21V9" />
      <path d="M7 14l5-5 5 5" />
      <path d="M5 3h14" />
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

function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 12h.01" />
      <path d="M12 5h.01" />
      <path d="M12 19h.01" />
    </svg>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 11h18" />
    </svg>
  );
}

function LinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
      <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 1 1-7-7l1-1" />
    </svg>
  );
}
