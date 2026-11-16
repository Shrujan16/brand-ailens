import { useState } from "react";
import { Check, Pencil, X, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SeverityBadge } from "@/components/StatusBadge";
import type { Finding } from "@/lib/brand-engine";
import { cn } from "@/lib/utils";

function Excerpt({ text, f }: { text: string; f: Finding }) {
  if (f.target !== "text" || f.start < 0) {
    return (
      <div className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground">{f.matchedText}</div>
    );
  }
  const long = f.end - f.start > 90;
  if (long) {
    return (
      <div className="rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
        <mark className="mark-finding">{f.matchedText.slice(0, 140)}{f.matchedText.length > 140 ? "…" : ""}</mark>
      </div>
    );
  }
  const a = Math.max(0, f.start - 40);
  const b = Math.min(text.length, f.end + 40);
  return (
    <div className="rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
      {a > 0 && "…"}
      {text.slice(a, f.start)}
      <mark className="mark-finding font-semibold">{text.slice(f.start, f.end)}</mark>
      {text.slice(f.end, b)}
      {b < text.length && "…"}
    </div>
  );
}

export function FindingCard({
  finding,
  text,
  active,
  onFocus,
  onAccept,
  onEdit,
  onDismiss,
}: {
  finding: Finding;
  text: string;
  active?: boolean;
  onFocus?: () => void;
  onAccept: () => void;
  onEdit: (value: string) => void;
  onDismiss: (reason: string) => void;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "dismiss">("idle");
  const [value, setValue] = useState(finding.suggestion ?? finding.matchedText);
  const [reason, setReason] = useState("");
  const canAccept = finding.suggestion != null && finding.suggestion !== "";

  return (
    <article
      id={`finding-${finding.key}`}
      onClick={onFocus}
      className={cn(
        "animate-rise rounded-2xl border bg-card p-4 shadow-soft transition-shadow",
        active ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="category">{finding.category}</Badge>
        <SeverityBadge severity={finding.severity} />
      </div>
      <Excerpt text={text} f={finding} />
      <p className="mt-3 text-sm text-foreground">{finding.explanation}</p>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <BookMarked className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>{finding.citation}</span>
      </p>
      {canAccept && (
        <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-success-soft px-3 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Suggested</span>
          <div className="mt-0.5 text-foreground">{finding.suggestion}</div>
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-3 space-y-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Your correction" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onEdit(value)} disabled={!value.trim() && finding.target !== "text"}>
              Apply edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {mode === "dismiss" && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this OK to publish? (required)"
            rows={2}
            aria-label="Reason for dismissing"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={!reason.trim()} onClick={() => onDismiss(reason.trim())}>
              Confirm dismiss
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "idle" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={onAccept} disabled={!canAccept}>
            <Check /> Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode("edit")}>
            <Pencil /> Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("dismiss")}>
            <X /> Dismiss
          </Button>
        </div>
      )}
    </article>
  );
}
