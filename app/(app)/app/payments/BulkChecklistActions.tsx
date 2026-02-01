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

type LinkStatus = "queued" | "in_progress" | "complete" | "error";

type LinkResult = RunSummary & {
  portalUrl?: string;
  error?: string;
  status: LinkStatus;
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
    setResults(runs.map((run) => ({ ...run, status: "queued" })));
    setCopySuccess(false);
    setError(null);

    const queue = [...runs];
    const concurrency = Math.min(4, runs.length);

    const updateResult = (runId: string, updates: Partial<LinkResult>) => {
      setResults((prev) =>
        prev.map((result) => (result.runId === runId ? { ...result, ...updates } : result))
      );
    };

    const worker = async () => {
      while (queue.length) {
        const run = queue.shift();
        if (!run) return;
        updateResult(run.runId, { status: "in_progress", error: undefined });
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

          updateResult(run.runId, { portalUrl: payload.portalUrl, status: "complete" });
        } catch (err) {
          updateResult(run.runId, {
            status: "error",
            error: err instanceof Error ? err.message : "Unable to generate link."
          });
        } finally {
          setCompleted((prev) => prev + 1);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
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
          <div className="grid gap-2">
            {results.map((result) => (
              <div
                key={result.runId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/60 px-3 py-2 text-xs"
              >
                <span className="font-medium text-foreground">{result.clientLabel}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(result.status)}>
                    {result.status === "in_progress" ? "In progress" : result.status}
                  </Badge>
                  {result.portalUrl ? (
                    <a
                      href={result.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
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
                  : `${result.clientLabel}: ${result.error || "Pending"}`
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

function statusVariant(status: LinkStatus) {
  switch (status) {
    case "complete":
      return "success";
    case "error":
      return "destructive";
    case "in_progress":
      return "info";
    case "queued":
    default:
      return "secondary";
  }
}
