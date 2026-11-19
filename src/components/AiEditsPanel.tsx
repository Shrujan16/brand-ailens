import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCheck, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { recommendEdits } from "@/lib/revision.functions";
import type { RecommendedEdit } from "@/lib/edit-recommendations";
import type { Finding } from "@/lib/brand-engine";
import type { CONTENT_TYPES } from "@/lib/data";

type Result = Awaited<ReturnType<typeof recommendEdits>>;
type EditState = "pending" | "applied" | "skipped" | "missing";

/**
 * Sends the draft plus its spelling & grammar findings to the AI, which combines them with the
 * brand-rule findings into specific edits. The creator applies or skips each edit.
 */
export function AiEditsPanel({
  title,
  contentType,
  text,
  findings,
  onApplyEdits,
}: {
  title: string;
  contentType: string;
  text: string;
  findings: Finding[];
  /** Applies edits to the current draft in order; returns the ids that still matched the text. */
  onApplyEdits: (edits: RecommendedEdit[]) => Set<string>;
}) {
  const recommendFn = useServerFn(recommendEdits);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [states, setStates] = useState<Record<string, EditState>>({});

  const textFindings = findings.filter((f) => f.target === "text");
  const spelling = textFindings.filter((f) => f.ruleRef === "spelling");
  const sgCount = textFindings.filter((f) => f.category === "Spelling & Grammar").length;
  const brandCount = textFindings.length - sgCount;

  async function recommend() {
    setLoading(true);
    try {
      const r = await recommendFn({
        data: {
          title,
          contentType: contentType as (typeof CONTENT_TYPES)[number],
          body: text,
          spelling: spelling.slice(0, 40).map((f) => ({ matchedText: f.matchedText, suggestion: f.suggestion })),
        },
      });
      setResult(r);
      setStates({});
      window.__lovableEvents?.track?.("project.ai_edits_requested", {
        content_type: contentType,
        edits: r.edits.length,
        rule_issues_before: r.ruleIssuesBefore,
        rule_issues_after: r.ruleIssuesAfter,
        spelling_issues: r.spellingIssues,
      });
      if (!r.edits.length) toast("No edits recommended", { description: "The AI found nothing it could safely change." });
    } catch (e) {
      toast.error("Could not get edit recommendations", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function apply(edit: RecommendedEdit) {
    const ok = onApplyEdits([edit]).has(edit.id);
    setStates((s) => ({ ...s, [edit.id]: ok ? "applied" : "missing" }));
    if (ok) {
      window.__lovableEvents?.track?.("project.ai_edit_applied", { category: edit.category, flagged: !!edit.warning });
    } else {
      toast.error("This edit no longer matches your draft.");
    }
  }

  function applyAll() {
    if (!result) return;
    const todo = result.edits.filter((e) => (states[e.id] ?? "pending") === "pending");
    const done = onApplyEdits(todo);
    const applied = done.size;
    const next: Record<string, EditState> = { ...states };
    for (const e of todo) next[e.id] = done.has(e.id) ? "applied" : "missing";
    setStates(next);
    window.__lovableEvents?.track?.("project.ai_edit_applied", { category: "all", count: applied });
    toast.success(`${applied} edit(s) applied`, { description: "Findings now reflect your edited draft." });
  }

  const pending = result?.edits.filter((e) => (states[e.id] ?? "pending") === "pending") ?? [];

  return (
    <div className="space-y-3 rounded-2xl border border-primary/25 bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-primary-deep">
            <Sparkles className="h-4 w-4" /> AI edit recommendations
          </div>
          <p className="text-xs text-muted-foreground">
            Combines {sgCount} spelling & grammar and {brandCount} brand-rule finding(s) into specific edits. You
            choose which to apply.
          </p>
        </div>
        <Button size="sm" variant="soft" onClick={recommend} disabled={loading || !text.trim() || !textFindings.length}>
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {result ? "Recommend again" : "Recommend edits"}
        </Button>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Reading your findings and the brand guidelines…</p>}

      {result && result.edits.length > 0 && (
        <div className="space-y-3">
          {result.summary && <p className="text-sm text-muted-foreground">{result.summary}</p>}
          <p
            className={
              result.ruleIssuesAfter === 0
                ? "flex items-start gap-2 text-xs text-primary"
                : "flex items-start gap-2 text-xs text-sev-medium"
            }
          >
            {result.ruleIssuesAfter === 0 ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              Rule check with all edits applied: {result.ruleIssuesBefore} brand/grammar issue(s) →{" "}
              {result.ruleIssuesAfter}. Spelling is re-checked after you apply.
            </span>
          </p>

          <ul className="space-y-2">
            {result.edits.map((e) => {
              const state = states[e.id] ?? "pending";
              return (
                <li
                  key={e.id}
                  className={`rounded-xl border p-3 text-sm ${state === "pending" ? "border-border" : "border-border bg-muted/50 opacity-75"}`}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="category">{e.category}</Badge>
                    {state === "applied" && <span className="text-xs font-semibold text-primary">Applied</span>}
                    {state === "skipped" && <span className="text-xs text-muted-foreground">Skipped</span>}
                    {state === "missing" && <span className="text-xs text-sev-high">No longer in draft</span>}
                  </div>
                  <div className="break-words">
                    <span className="text-muted-foreground line-through">{e.original}</span>{" "}
                    → <span className="font-medium text-foreground">{e.replacement || "(remove)"}</span>
                  </div>
                  {e.reason && <p className="mt-1 text-xs text-muted-foreground">{e.reason}</p>}
                  {e.warning && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-sev-medium">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e.warning}
                    </p>
                  )}
                  {state === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => apply(e)}>
                        <Check /> Apply
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStates((s) => ({ ...s, [e.id]: "skipped" }))}>
                        <X /> Skip
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={applyAll} disabled={!pending.length}>
              <CheckCheck /> Apply remaining ({pending.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
