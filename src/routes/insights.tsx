import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { allFindingsQuery, STATUS_LABEL, submissionsQuery, type Status } from "@/lib/data";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — BrandLens" },
      { name: "description", content: "See which brand issues come up most often across GreenLeaf submissions." },
      { property: "og:title", content: "Insights — BrandLens" },
      { property: "og:description", content: "See which brand issues come up most often across GreenLeaf submissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(submissionsQuery),
      context.queryClient.ensureQueryData(allFindingsQuery),
    ]),
  component: InsightsPage,
});

const chartConfig = {
  count: { label: "Findings", color: "var(--chart-1)" },
} satisfies ChartConfig;

function InsightsPage() {
  const { data: submissions } = useSuspenseQuery(submissionsQuery);
  const { data: findings } = useSuspenseQuery(allFindingsQuery);

  const byCategory = Object.entries(
    findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.category] = (acc[f.category] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  // Spelling & Grammar always appears in the chart, even before any such finding exists.
  const chartData = byCategory.some((c) => c.category === "Spelling & Grammar")
    ? byCategory
    : [...byCategory, { category: "Spelling & Grammar", count: 0 }];

  // Group by the rule that fired; label with its citation (without the fact's full statement).
  const ruleLabel = (citation: string) =>
    citation.replace(/^(Brand rule|Terminology):\s*/, "$1 · ").split(": ")[0] ?? citation;
  const topRules = Object.entries(
    findings.reduce<Record<string, number>>((acc, f) => {
      const k = ruleLabel(f.citation);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const resolved = findings.filter((f) => f.status !== "open").length;
  const statusCounts = (Object.keys(STATUS_LABEL) as Status[]).map((s) => ({
    s,
    n: submissions.filter((x) => x.status === s).length,
  }));
  const severity = ["high", "medium", "low"].map((s) => ({ s, n: findings.filter((f) => f.severity === s).length }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Across all submissions</p>
      <h1 className="mt-1 text-3xl font-semibold text-primary-deep md:text-4xl">Insights</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Submissions" value={submissions.length} />
        <Kpi label="Findings raised" value={findings.length} />
        <Kpi label="Resolved by creators" value={findings.length ? `${Math.round((resolved / findings.length) * 100)}%` : "—"} />
        <Kpi label="Most common issue" value={byCategory[0]?.category ?? "—"} small />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-primary-deep">Most frequent issue types</h2>
          {byCategory.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No findings yet.</p>
          ) : (
            <ChartContainer config={chartConfig} className="mt-4 h-[320px] w-full">
              <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="category" width={130} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-primary-deep">By severity</h2>
            <div className="mt-3 space-y-2">
              {severity.map(({ s, n }) => (
                <Meter key={s} label={s} n={n} total={findings.length} tone={s} />
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-primary-deep">Submission status</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {statusCounts.map(({ s, n }) => (
                <li key={s} className="flex justify-between">
                  <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
                  <span className="font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-primary-deep">Top triggered rules</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {topRules.map(([rule, n]) => (
                <li key={rule} className="flex justify-between gap-3">
                  <span className="truncate text-muted-foreground">{rule}</span>
                  <span className="font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={small ? "mt-1 font-display text-lg font-semibold text-primary-deep" : "mt-1 font-display text-3xl font-semibold text-primary-deep"}>
        {value}
      </div>
    </div>
  );
}

const METER_BG: Record<string, string> = { high: "bg-sev-high", medium: "bg-sev-medium", low: "bg-sev-low" };

function Meter({ label, n, total, tone }: { label: string; n: number; total: number; tone: string }) {
  const pct = total ? (n / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="capitalize text-muted-foreground">{label}</span>
        <span className="font-semibold">{n}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${METER_BG[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
