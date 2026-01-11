import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    title: "Batch-first workflow",
    description: "Save wizard sessions into batches, then revisit and reuse them without starting from scratch."
  },
  {
    title: "Client checklist portal",
    description: "Publish a secure checklist link so clients can confirm payments after they submit."
  },
  {
    title: "Payments board",
    description: "Filter by due window and status, then generate portal links in bulk for the rows in view."
  },
  {
    title: "Clean, minimal UI",
    description: "Soft surfaces, consistent components, and accessible focus states—no UI noise."
  },
  {
    title: "Secure by default",
    description: "Credentials auth via NextAuth. Data stored in Postgres via Prisma."
  },
  {
    title: "Built for speed",
    description: "App Router + server components where it matters for crisp navigation and fast pages."
  }
];

export default function HomePage() {
  return (
    <div className="grid gap-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Badge variant="secondary" className="mb-4 w-fit bg-secondary/70">
            Minimal, secure, fast
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Tax payment schedules, without the chaos.
          </h1>
          <p className="mt-4 text-balance text-base text-muted-foreground sm:text-lg">
            Build payment schedules, generate client drafts, and track confirmations—across batches—without
            losing the thread.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Credentials auth via NextAuth. Data stored in Postgres via Prisma.
          </p>
        </div>

        <Card className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,hsl(var(--primary)_/_0.18),transparent_70%)]"
          />
          <CardHeader className="relative">
            <CardTitle>Payments board</CardTitle>
            <CardDescription>Filter by due window and status. Generate portal links in bulk.</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid gap-3">
              {[
                { label: "Jan 15", client: "Acme LLC", status: "DUE SOON" },
                { label: "Jan 31", client: "Northwind Inc", status: "SENT" },
                { label: "Feb 15", client: "Client", status: "CONFIRMED" },
                { label: "Apr 15", client: "Client", status: "DRAFT" }
              ].map((row) => (
                <div
                  key={`${row.label}-${row.client}`}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.client}</p>
                    <p className="text-xs text-muted-foreground">Due {row.label}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="features" className="grid gap-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            A calmer workflow for accounting teams
          </h2>
          <p className="mt-2 text-muted-foreground">
            Polished UI, consistent components, and thoughtful defaults—designed to reduce friction.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="bg-card/70 backdrop-blur">
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">{feature.title}</CardTitle>
                <CardDescription className="text-sm">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="workflow" className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>From wizard → to dashboard</CardTitle>
            <CardDescription>
              Build schedules in the legacy wizard, then track outcomes in a modern board.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-xl border bg-background/60 px-4 py-3">
              Save a wizard run into a batch.
            </div>
            <div className="rounded-xl border bg-background/60 px-4 py-3">
              Publish a portal checklist link per client.
            </div>
            <div className="rounded-xl border bg-background/60 px-4 py-3">
              Clients confirm payments; you see status updates.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Designed for focus</CardTitle>
            <CardDescription>
              Generous spacing, soft surfaces, and clear hierarchy for day-to-day use.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-xl border bg-background/60 px-4 py-3">
              Better empty states and table readability.
            </div>
            <div className="rounded-xl border bg-background/60 px-4 py-3">
              Clear labels and helper text for forms.
            </div>
            <div className="rounded-xl border bg-background/60 px-4 py-3">
              Subtle hover/focus states with accessible contrast.
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="security" className="rounded-3xl border bg-card/70 p-8 shadow-soft backdrop-blur">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Security that doesn’t get in the way</h2>
            <p className="mt-2 text-muted-foreground">
              Auth stays locked down, protected routes stay protected, and the client portal keeps sharing
              simple.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-secondary/70">
              NextAuth Credentials
            </Badge>
            <Badge variant="secondary" className="bg-secondary/70">
              Prisma + Postgres
            </Badge>
            <Badge variant="secondary" className="bg-secondary/70">
              Protected middleware
            </Badge>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/register">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
