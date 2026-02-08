import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNewBatch } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?next=/app");
  }

  const [workflows, clients] = await Promise.all([
    prisma.batch.findMany({
      where: { userId, kind: "WIZARD" },
      orderBy: { updatedAt: "desc" },
      take: 5
    }),
    prisma.client.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 8
    })
  ]);

  return (
    <div className="grid gap-8">
      <Card className="relative overflow-hidden bg-card/70 backdrop-blur">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(70%_60%_at_10%_0%,hsl(var(--primary)_/_0.18),transparent_70%)]"
        />
        <CardHeader className="relative space-y-0">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Dashboard
              </p>
              <CardTitle className="text-2xl sm:text-3xl">Welcome back</CardTitle>
              <CardDescription>Signed in as {session?.user?.email}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/wizard">Open client plans</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/payments">View payments</Link>
              </Button>
              <form action={createNewBatch}>
                <Button variant="secondary" type="submit">
                  New workflow
                </Button>
              </form>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Recent workflows</CardTitle>
            <CardDescription>Track recent planning activity and reopen any workflow instantly.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {workflows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow name</TableHead>
                    <TableHead className="w-[200px]">Last updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((workflow) => (
                    <TableRow key={workflow.id}>
                      <TableCell className="font-medium">{workflow.name}</TableCell>
                      <TableCell className="text-muted-foreground">{workflow.updatedAt.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-10">
                <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                  No workflows yet. Create one to start planning client payments.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Clients</CardTitle>
              <CardDescription>Recently edited clients synced from your planning workspace.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/clients">View all</Link>
            </Button>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {clients.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-[180px]">Entity type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.name || client.addresseeName || "Unnamed"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{client.entityType || "Unknown"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-10">
                <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                  Clients will appear here after you save them in client plans.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
