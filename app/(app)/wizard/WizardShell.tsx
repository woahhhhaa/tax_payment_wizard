"use client";

import type { SVGProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type WizardWindow = Window & {
  newSession?: () => void;
  saveSessionJson?: () => void;
  triggerLoadSessionJson?: () => void;
  exportSessionCsv?: () => void;
  triggerImportCsv?: () => void;
  generateSessionDrafts?: () => void;
  generateChecklistLink?: () => void;
  reportBug?: () => void;
};

type SaveState = "idle" | "saving" | "error";

function normalizeSaveState(value: string | null): SaveState {
  if (value === "saving" || value === "error") return value;
  return "idle";
}

function saveBadgeVariant(state: SaveState): "success" | "info" | "destructive" {
  switch (state) {
    case "saving":
      return "info";
    case "error":
      return "destructive";
    case "idle":
    default:
      return "success";
  }
}

export function WizardShell() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ state: SaveState; label: string }>({
    state: "idle",
    label: "Saved"
  });

  const wizardIframeSrc = useMemo(() => "/tax_payment_wizard_new.html?embed=1", []);
  const wizardStandaloneHref = useMemo(() => "/tax_payment_wizard_new.html", []);

  const callWizard = useCallback((fnName: keyof WizardWindow) => {
    const win = iframeRef.current?.contentWindow as WizardWindow | null;
    const fn = win?.[fnName];
    if (typeof fn === "function") {
      fn();
    }
  }, []);

  const syncSessionName = useCallback((value: string) => {
    setSessionName(value);
    const doc = iframeRef.current?.contentDocument;
    const input = doc?.getElementById("sessionNameInput") as HTMLInputElement | null;
    if (input) {
      input.value = value;
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    const sessionInput = doc.getElementById("sessionNameInput") as HTMLInputElement | null;
    if (sessionInput?.value) {
      setSessionName((current) => current || sessionInput.value);
    }

    const statusEl = doc.getElementById("saveStatus");
    if (!statusEl) return;

    const readStatus = () => {
      setSaveStatus({
        state: normalizeSaveState(statusEl.getAttribute("data-state")),
        label: statusEl.textContent?.trim() || "Saved"
      });
    };

    readStatus();

    const observer = new MutationObserver(readStatus);
    observer.observe(statusEl, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [isLoaded]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Wizard</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tax Payment Wizard</h1>
          <p className="text-sm text-muted-foreground">
            Build client payment tasks, then publish portal checklists.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="gap-2" onClick={() => callWizard("newSession")}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            New session
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => callWizard("exportSessionCsv")}>
            <DownloadIcon className="h-4 w-4" aria-hidden />
            Export
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => callWizard("triggerImportCsv")}>
            <UploadIcon className="h-4 w-4" aria-hidden />
            Import
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Session</span>
            <Badge variant={saveBadgeVariant(saveStatus.state)} className="capitalize">
              {saveStatus.label}
            </Badge>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Input
              value={sessionName}
              onChange={(event) => syncSessionName(event.target.value)}
              placeholder="Session name"
              className="w-full sm:w-[320px]"
              aria-label="Session name"
            />
            <Button type="button" variant="secondary" className="shrink-0" onClick={() => callWizard("saveSessionJson")}>
              Save
            </Button>
            <Button type="button" variant="outline" className="shrink-0" onClick={() => callWizard("triggerLoadSessionJson")}>
              Load
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => callWizard("generateSessionDrafts")}>
            <MailIcon className="h-4 w-4" aria-hidden />
            Draft emails
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => callWizard("generateChecklistLink")}>
            <LinkIcon className="h-4 w-4" aria-hidden />
            Checklist link
          </Button>
          <Button type="button" variant="ghost" className="gap-2" onClick={() => callWizard("reportBug")}>
            <BugIcon className="h-4 w-4" aria-hidden />
            Report
          </Button>
          <Button asChild type="button" variant="ghost" className="gap-2">
            <Link href={wizardStandaloneHref} target="_blank" rel="noreferrer">
              <ExternalLinkIcon className="h-4 w-4" aria-hidden />
              Open
            </Link>
          </Button>
        </div>
      </div>

      <div className={cn("overflow-hidden rounded-2xl border bg-background shadow-soft", "min-h-[70vh]")}>
        {!isLoaded ? (
          <div className="flex items-center justify-center px-6 py-10 text-sm text-muted-foreground">
            Loading wizard…
          </div>
        ) : null}
        <iframe
          ref={iframeRef}
          title="Tax Payment Wizard"
          src={wizardIframeSrc}
          className={cn("h-[calc(100vh-260px)] min-h-[700px] w-full", !isLoaded && "hidden")}
          onLoad={() => setIsLoaded(true)}
        />
      </div>
    </div>
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

function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
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

function BugIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M19 8h-3a2 2 0 0 0-4 0H9" />
      <path d="M12 10v10" />
      <path d="M8 12l-3-2" />
      <path d="M16 12l3-2" />
      <path d="M8 16l-3 2" />
      <path d="M16 16l3 2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function ExternalLinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" />
    </svg>
  );
}
