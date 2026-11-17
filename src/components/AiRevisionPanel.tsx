import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldCheck, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestRevision } from "@/lib/revision.functions";
import type { CONTENT_TYPES } from "@/lib/data";

type Suggestion = Awaited<ReturnType<typeof suggestRevision>>;

export function AiRevisionPanel({
  title,
  contentType,
  text,
  onApply,
}: {
  title: string;
  contentType: string;
  text: string;
  onApply: (revised: string) => void;
}) {
  const suggestFn = useServerFn(suggestRevision);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Suggestion | null>(null);
  const [sourceText, setSourceText] = useState("");

  async function suggest() {
    setLoading(true);
    try {
      const r = await suggestFn({
        data: { title, contentType: contentType as (typeof CONTENT_TYPES)[number], body: text },
      });
      setResult(r);
      setSourceText(text);
    } catch (e) {
      toast.error("Could not get a suggestion", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const stale = result && sourceText !== text;

  return (
    <div className="space-y-3 rounded-2xl border border-primary/25 bg-success-soft/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-primary-deep">
            <Wand2 className="h-4 w-4" /> AI revision suggestions
          </div>
          <p className="text-xs text-muted-foreground">
            Rewrites your draft using the saved guidelines and approved facts. You decide what to keep.
          </p>
        </div>
        <Button size="sm" variant="soft" onClick={suggest} disabled={loading || !text.trim()}>
          {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {result ? "Suggest again" : "Suggest revision"}
        </Button>
      </div>

      {loading && !result && (
        <p className="text-xs text-muted-foreground">Reading your guidelines and drafting a revision…</p>
      )}

      {result && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {stale && (
            <p className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              Your draft changed since this suggestion was made.
            </p>
          )}
          {result.summary && <p className="text-sm text-muted-foreground">{result.summary}</p>}
          <div className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-[15px] leading-7 text-foreground">
            {result.revisedText}
          </div>

          <div
            className={
              result.remaining.length === 0
                ? "flex items-start gap-2 text-xs text-primary"
                : "flex items-start gap-2 text-xs text-sev-high"
            }
          >
            {result.remaining.length === 0 ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              Rule check on this suggestion: {result.issuesBefore} text issue(s) before →{" "}
              {result.remaining.length} after
              {result.remaining.length > 0 &&
                ` (${result.remaining.map((r) => `${r.category}: “${r.matchedText}”`).join("; ")})`}
            </span>
          </div>

          {result.changes.length > 0 && (
            <ul className="space-y-2 text-sm">
              {result.changes.map((c, i) => (
                <li key={i} className="rounded-lg border border-border p-2.5">
                  <div>
                    <span className="text-muted-foreground line-through">{c.original || "—"}</span>{" "}
                    → <span className="font-medium text-foreground">{c.revised || "(removed)"}</span>
                  </div>
                  {c.reason && <div className="mt-1 text-xs text-muted-foreground">{c.reason}</div>}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onApply(result.revisedText);
                setResult(null);
              }}
            >
              <CheckCircle2 /> Use this revision
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
