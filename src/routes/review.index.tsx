import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, Inbox } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { allFindingsQuery, STATUS_LABEL, submissionsQuery, type Status } from "@/lib/data";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/review/")({
  head: () => ({
    meta: [
      { title: "Review queue — BrandLens" },
      { name: "description", content: "Review submitted GreenLeaf content, comment, approve or request changes." },
      { property: "og:title", content: "Review queue — BrandLens" },
      { property: "og:description", content: "Review submitted GreenLeaf content, comment, approve or request changes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(submissionsQuery),
      context.queryClient.ensureQueryData(allFindingsQuery),
    ]),
  component: ReviewQueue,
});

const FILTERS: Array<"all" | Status> = ["in_review", "changes_requested", "approved", "draft", "all"];

function ReviewQueue() {
  const { data: submissions } = useSuspenseQuery(submissionsQuery);
  const { data: findings } = useSuspenseQuery(allFindingsQuery);
  const { role } = useRole();
  const [filter, setFilter] = useState<"all" | Status>("in_review");

  const list = submissions.filter((s) => filter === "all" || s.status === filter);
  const count = (f: "all" | Status) => submissions.filter((s) => f === "all" || s.status === f).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Reviewer</p>
      <h1 className="mt-1 text-3xl font-semibold text-primary-deep md:text-4xl">Review queue</h1>
      {role !== "reviewer" && (
        <p className="mt-3 rounded-xl bg-harvest-soft px-3 py-2 text-sm text-harvest-foreground">
          You’re viewing as a Creator. Switch to <strong>Reviewer</strong> in the header to approve content.
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Your submissions are private to this browser. Items marked <strong>Example</strong> are read-only samples.
      </p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? "All" : STATUS_LABEL[f]} <span className="opacity-70">({count(f)})</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {list.length === 0 && (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 text-primary" />
            <p className="mt-2">Nothing here yet.</p>
          </div>
        )}
        {list.map((s) => {
          const open = findings.filter((f) => f.submission_id === s.id && f.revision === s.revision && f.status === "open");
          const high = open.filter((f) => f.severity === "high").length;
          return (
            <Link
              key={s.id}
              to="/review/$id"
              params={{ id: s.id }}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-lift"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{s.title}</span>
                  <StatusBadge status={s.status} />
                  {s.is_sample && <Badge variant="outline">Example</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {s.content_type} · {s.author_name} · revision {s.revision} · {new Date(s.updated_at).toLocaleString()}
                </div>
                <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
              <div className="hidden text-right text-xs sm:block">
                <div className="font-display text-2xl font-semibold text-foreground">{open.length}</div>
                <div className="text-muted-foreground">open{high ? ` · ${high} high` : ""}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
