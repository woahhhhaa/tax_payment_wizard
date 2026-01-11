"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PortalLinkActionsProps = {
  runId: string;
  clientLabel: string;
};

export function PortalLinkActions({ runId, clientLabel }: PortalLinkActionsProps) {
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function generateLink() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/plans/publish-by-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to generate link.");
      }

      const payload = await response.json().catch(() => ({}));
      if (!payload?.portalUrl) {
        throw new Error("Missing portal URL.");
      }

      setPortalUrl(payload.portalUrl);
      if (autoOpen) {
        window.open(payload.portalUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate link.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopySuccess(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch {
      setError("Copy failed. Please copy the link manually.");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" type="button" onClick={generateLink} disabled={loading}>
          {loading ? "Generating..." : portalUrl ? "Regenerate" : "Generate"}
        </Button>
        <Button size="sm" type="button" onClick={copyLink} disabled={!portalUrl}>
          {copySuccess ? "Copied" : "Copy"}
        </Button>
        {portalUrl ? (
          <Button asChild size="sm" variant="secondary">
            <a href={portalUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          </Button>
        ) : null}
      </div>

      {portalUrl ? (
        <Input type="text" readOnly value={portalUrl} className="h-9 text-xs" />
      ) : (
        <p className="text-xs text-muted-foreground">Generate a checklist link for {clientLabel}.</p>
      )}

      <div className="flex items-center gap-2">
        <input
          id={`auto-open-${runId}`}
          type="checkbox"
          checked={autoOpen}
          onChange={(event) => setAutoOpen(event.target.checked)}
          className="h-4 w-4 rounded border-input text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        />
        <Label htmlFor={`auto-open-${runId}`} className="text-xs font-normal text-muted-foreground">
          Auto-open after generate
        </Label>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
