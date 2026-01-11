"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type RunSummary = {
  runId: string;
  clientLabel: string;
};

type LinkResult = RunSummary & {
  portalUrl?: string;
  error?: string;
};

export function BulkChecklistActions({ runs }: { runs: RunSummary[] }) {
  const [results, setResults] = useState<LinkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const successLinks = useMemo(
    () => results.filter((result) => result.portalUrl),
    [results]
  );
  const progressPercent = runs.length ? Math.min((completed / runs.length) * 100, 100) : 0;

  async function generateAll() {
    if (!runs.length || loading) return;
    setLoading(true);
    setCompleted(0);
    setResults([]);
    setCopySuccess(false);
    setError(null);

    const generated = await Promise.all(
      runs.map(async (run) => {
        try {
          const response = await fetch("/api/plans/publish-by-run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runId: run.runId })
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.error || "Unable to generate link.");
          }

          const payload = await response.json().catch(() => ({}));
          if (!payload?.portalUrl) {
            throw new Error("Missing portal URL.");
          }

          return { ...run, portalUrl: payload.portalUrl };
        } catch (err) {
          return {
            ...run,
            error: err instanceof Error ? err.message : "Unable to generate link."
          };
        } finally {
          setCompleted((prev) => prev + 1);
        }
      })
    );

    setResults(generated);
    setLoading(false);
  }

  async function copyAll() {
    if (!successLinks.length) {
      setError("No links to copy yet.");
      return;
    }
    const payload = successLinks.map((result) => result.portalUrl).join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setError("Copy failed. Please copy manually.");
    }
  }

  return (
    <Card className="bg-card/70 backdrop-blur">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Checklist links</CardTitle>
            <CardDescription>Generate portal links for the rows currently in view.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-secondary/70">
              {runs.length} run{runs.length === 1 ? "" : "s"}
            </Badge>
            {results.length ? (
              <Badge variant="secondary" className="bg-secondary/70">
                {successLinks.length} success
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="grid gap-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={generateAll} disabled={loading || !runs.length}>
            {loading ? `Generating ${completed}/${runs.length}` : "Generate links"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={copyAll}
            disabled={!successLinks.length}
          >
            {copySuccess ? "Copied!" : "Copy all"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {runs.length
              ? `${runs.length} client${runs.length === 1 ? "" : "s"} in view`
              : "No rows to generate"}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              Generating links… {completed}/{runs.length}
            </p>
          </div>
        ) : null}

        {results.length > 0 ? (
          <Textarea
            rows={Math.min(10, Math.max(3, results.length))}
            readOnly
            value={results
              .map((result) =>
                result.portalUrl
                  ? `${result.clientLabel}: ${result.portalUrl}`
                  : `${result.clientLabel}: ${result.error || "Failed"}`
              )
              .join("\n")}
            className="bg-background font-mono text-xs"
          />
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/15 p-6 text-sm text-muted-foreground">
            Generate links, then copy them into an email or your task system.
          </div>
        )}

        {error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
