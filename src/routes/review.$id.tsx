import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  BookMarked,
  History,
  Loader2,
  MessageCircle,
  PenLine,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { HighlightedText, rangesFromSnippets } from "@/components/HighlightedText";
import { SeverityBadge, StatusBadge } from "@/components/StatusBadge";
import { SubmissionImage } from "@/components/SubmissionImage";
import { useServerFn } from "@tanstack/react-start";
import { addComment as addCommentServer, decideSubmission } from "@/lib/brandlens.functions";
import { submissionDetailQuery, type FindingRow } from "@/lib/data";
import { contrastRatio } from "@/lib/brand-engine";
import { useRole } from "@/lib/role";

export const Route = createFileRoute("/review/$id")({
  head: () => ({
    meta: [
      { title: "Review submission — BrandLens" },
      { name: "description", content: "Review a GreenLeaf content submission with its brand findings and history." },
      { property: "og:title", content: "Review submission — BrandLens" },
      { property: "og:description", content: "Review a GreenLeaf content submission with its brand findings and history." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(submissionDetailQuery(params.id));
    if (!data.submission) throw notFound();
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-primary-deep">Submission not found</h1>
      <Link to="/review" className="mt-4 inline-block text-primary underline">
        Back to the queue
      </Link>
    </div>
  ),
  component: ReviewDetail,
});

const ACTION_LABEL: Record<string, string> = {
  draft_saved: "Draft saved",
  submitted: "Submitted for review",
  resubmitted: "Resubmitted with changes",
  approved: "Approved",
  changes_requested: "Changes requested",
  commented: "Commented",
};

function ReviewDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(submissionDetailQuery(id));
  const { role } = useRole();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<null | "comment" | "approve" | "changes">(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const addCommentFn = useServerFn(addCommentServer);
  const decideFn = useServerFn(decideSubmission);

  const s = data.submission!;
  const current = data.findings.filter((f) => f.revision === s.revision);
  const open = current.filter((f) => f.status === "open");
  const fixed = current.filter((f) => f.status === "accepted" || f.status === "edited");
  const dismissed = current.filter((f) => f.status === "dismissed");
  const isReviewer = role === "reviewer";
  const readOnly = data.readOnly;
  const ratio = s.text_color && s.bg_color ? contrastRatio(s.text_color, s.bg_color) : null;

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["submission", id] }),
      qc.invalidateQueries({ queryKey: ["submissions"] }),
      qc.invalidateQueries({ queryKey: ["findings"] }),
    ]);
  }

  async function addComment() {
    if (!comment.trim()) return;
    setBusy("comment");
    try {
      await addCommentFn({ data: { submissionId: id, role, body: comment.trim() } });
      setComment("");
      await refresh();
    } catch (e) {
      toast.error("Could not post comment", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: "approved" | "changes_requested") {
    if (!isReviewer) {
      toast.error("Only a Reviewer can do this.");
      return;
    }
    if (decision === "changes_requested" && !comment.trim()) {
      toast.error("Add a comment explaining what needs to change.");
      return;
    }
    setBusy(decision === "approved" ? "approve" : "changes");
    try {
      await decideFn({ data: { submissionId: id, role, decision, comment: comment.trim() } });
      window.__lovableEvents?.track?.("project.review_decision_made", {
        decision,
        revision: s.revision,
        open_findings: open.length,
        resolved_findings: fixed.length + dismissed.length,
      });
      setComment("");
      await refresh();
      toast.success(decision === "approved" ? "Approved for publishing" : "Changes requested");
    } catch (e) {
      toast.error("Could not update", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <Link to="/review" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Review queue
      </Link>

      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold text-primary-deep">{s.title}</h1>
            <StatusBadge status={s.status} />
            {readOnly && <Badge variant="outline">Example</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {s.content_type} · {s.author_name} · revision {s.revision} · updated {new Date(s.updated_at).toLocaleString()}
          </p>
        </div>
        {!readOnly && (s.status === "changes_requested" || s.status === "draft") && (
          <Button asChild variant="soft">
            <Link to="/" search={{ edit: s.id }}>
              <PenLine /> Revise as Creator
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
            <h2 className="mb-3 text-lg font-semibold text-primary-deep">Content</h2>
            <HighlightedText
              text={s.body}
              ranges={rangesFromSnippets(s.body, open)}
              activeId={activeId}
              onSelect={setActiveId}
            />
            {(s.image_url || ratio) && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {s.image_url && (
                  <figure className="overflow-hidden rounded-2xl border border-border">
                    <SubmissionImage src={s.image_url} alt={s.image_alt} className="aspect-[4/3] w-full object-cover" />
                    <figcaption className="px-3 py-2 text-xs text-muted-foreground">
                      Alt text: {s.image_alt ? `“${s.image_alt}”` : <span className="font-semibold text-sev-high">missing</span>}
                    </figcaption>
                  </figure>
                )}
                {ratio && (
                  <div className="rounded-2xl border border-border p-3">
                    <div
                      className="flex h-24 items-center justify-center rounded-xl text-lg font-semibold"
                      style={{ color: s.text_color!, backgroundColor: s.bg_color! }}
                    >
                      Sample text
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {s.text_color} on {s.bg_color} · contrast {ratio.toFixed(2)}:1
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-primary-deep">
              <ShieldAlert className="h-5 w-5 text-primary" /> Open findings ({open.length})
            </h2>
            {open.length === 0 && (
              <p className="rounded-2xl border border-primary/30 bg-success-soft p-4 text-sm">No open findings in this revision.</p>
            )}
            {open.map((f) => (
              <StoredFinding key={f.id} f={f} active={activeId === f.id} onClick={() => setActiveId(f.id)} />
            ))}
            {(fixed.length > 0 || dismissed.length > 0) && (
              <details className="rounded-2xl border border-border bg-card p-4">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  Resolved by creator — {fixed.length} fixed, {dismissed.length} dismissed
                </summary>
                <div className="mt-3 space-y-3">
                  {[...fixed, ...dismissed].map((f) => (
                    <StoredFinding key={f.id} f={f} />
                  ))}
                </div>
              </details>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-primary-deep">
              <MessageCircle className="h-5 w-5 text-primary" /> Comments
            </h2>
            <div className="mt-3 space-y-3">
              {data.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
              {data.comments.map((c) => (
                <div key={c.id} className="rounded-xl bg-muted px-3 py-2">
                  <div className="text-xs font-semibold capitalize text-primary-deep">
                    {c.author_role} · <span className="font-normal text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-foreground">{c.body}</p>
                </div>
              ))}
            </div>
            {readOnly ? (
              <p className="mt-4 rounded-xl bg-harvest-soft px-3 py-2 text-sm text-harvest-foreground">
                This is a read-only example. Submit your own content from the{" "}
                <Link to="/" className="font-semibold underline">
                  Create page
                </Link>{" "}
                to comment, approve or request changes.
              </p>
            ) : (
            <>
            <Textarea
              className="mt-4"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isReviewer ? "Feedback for the creator…" : "Add a comment…"}
              aria-label="Comment"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={addComment} disabled={!comment.trim() || !!busy}>
                {busy === "comment" && <Loader2 className="animate-spin" />} Comment
              </Button>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              {isReviewer ? (
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                  <Button className="flex-1" onClick={() => decide("approved")} disabled={!!busy || s.status === "approved"}>
                    {busy === "approve" ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Approve
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => decide("changes_requested")}
                    disabled={!!busy || s.status === "changes_requested"}
                  >
                    {busy === "changes" ? <Loader2 className="animate-spin" /> : <RotateCcw />} Request changes
                  </Button>
                </div>
              ) : (
                <p className="rounded-xl bg-harvest-soft px-3 py-2 text-sm text-harvest-foreground">
                  Only a Reviewer can approve or request changes. Switch role in the header.
                </p>
              )}
              {isReviewer && open.some((f) => f.severity === "high") && s.status !== "approved" && (
                <p className="mt-2 text-xs text-sev-high">
                  Heads up: {open.filter((f) => f.severity === "high").length} high-severity issue(s) still open.
                </p>
              )}
            </div>
            </>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-primary-deep">
              <History className="h-5 w-5 text-primary" /> Revision history
            </h2>
            <ol className="mt-4 space-y-4 border-l-2 border-border pl-4">
              {data.audit.map((a) => {
                const d = a.details as { revision?: number; body?: string; comment?: string; open_findings?: number };
                return (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary" />
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      {ACTION_LABEL[a.action] ?? a.action}
                      {d.revision && <Badge variant="outline">rev {d.revision}</Badge>}
                    </div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {a.actor_role} · {new Date(a.created_at).toLocaleString()}
                      {typeof d.open_findings === "number" && ` · ${d.open_findings} open finding(s)`}
                    </div>
                    {d.comment && <p className="mt-1 text-sm text-muted-foreground">“{d.comment}”</p>}
                    {d.body && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-primary">View text</summary>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs text-muted-foreground">{d.body}</p>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

const STATUS_TEXT: Record<string, string> = {
  open: "Open",
  accepted: "Fix accepted",
  edited: "Edited by creator",
  dismissed: "Dismissed",
};

function StoredFinding({ f, active, onClick }: { f: FindingRow; active?: boolean; onClick?: () => void }) {
  return (
    <article
      onClick={onClick}
      className={`rounded-2xl border bg-card p-4 shadow-soft ${active ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="category">{f.category}</Badge>
        <SeverityBadge severity={f.severity} />
        <span className="ml-auto text-xs font-medium text-muted-foreground">{STATUS_TEXT[f.status] ?? f.status}</span>
      </div>
      <div className="mt-2 rounded-lg bg-muted px-3 py-1.5 text-sm">
        <mark className="mark-finding">{f.matched_text.slice(0, 160)}</mark>
      </div>
      <p className="mt-2 text-sm text-foreground">{f.explanation}</p>
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
        <BookMarked className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {f.citation}
      </p>
      {f.suggestion && (
        <p className="mt-1.5 text-xs text-primary-deep">
          {f.status === "open" ? "Suggested" : "Applied"}: <strong>{f.suggestion}</strong>
        </p>
      )}
      {f.dismiss_reason && <p className="mt-1.5 text-xs text-muted-foreground">Reason: “{f.dismiss_reason}”</p>}
    </article>
  );
}
