import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeverityBadge } from "@/components/StatusBadge";
import { useServerFn } from "@tanstack/react-start";
import { mutateKnowledge } from "@/lib/brandlens.functions";
import { knowledgeQuery } from "@/lib/data";
import { useRole } from "@/lib/role";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "Brand Knowledge — BrandLens" },
      { name: "description", content: "View and edit GreenLeaf Organics guidelines, approved facts and terminology." },
      { property: "og:title", content: "Brand Knowledge — BrandLens" },
      { property: "og:description", content: "View and edit GreenLeaf Organics guidelines, approved facts and terminology." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(knowledgeQuery),
  component: KnowledgePage,
});

type FieldType = "text" | "textarea" | "number" | "list" | "select";
interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  hint?: string;
}
type Table = "brand_rules" | "approved_facts" | "terminology";
type Row = Record<string, unknown> & { id: string };

const RULE_KINDS: Record<string, string> = {
  tone: "Tone of voice",
  banned_phrase: "Banned words",
  superlative: "Unsupported superlatives",
  visual_palette: "Visual · palette",
  visual_contrast: "Visual · contrast",
  alt_text: "Visual · alt text",
  readability: "Readability",
};
const SEVERITIES = ["high", "medium", "low"];

const RULE_FIELDS: Field[] = [
  { key: "kind", label: "Type", type: "select", options: Object.keys(RULE_KINDS) },
  { key: "label", label: "Label", type: "text" },
  { key: "value", label: "Value", type: "text", hint: "Phrase to detect, number limit, or palette hex codes" },
  { key: "suggestion", label: "Suggested replacement", type: "text" },
  { key: "description", label: "Explanation", type: "textarea" },
  { key: "severity", label: "Severity", type: "select", options: SEVERITIES },
];
const FACT_FIELDS: Field[] = [
  { key: "label", label: "Label", type: "text" },
  { key: "statement", label: "Approved statement", type: "textarea" },
  { key: "fact_type", label: "Checked as", type: "select", options: ["price", "year", "days", "text"] },
  { key: "numeric_value", label: "Correct number", type: "number" },
  { key: "context_terms", label: "Context words", type: "list", hint: "Comma-separated words that link a number to this fact" },
  { key: "fact_key", label: "Key", type: "text" },
];
const TERM_FIELDS: Field[] = [
  { key: "preferred", label: "Preferred term", type: "text" },
  { key: "rule_type", label: "Rule", type: "select", options: ["replace", "requires"] },
  { key: "incorrect", label: "Wrong variants", type: "list", hint: "Comma-separated (for “replace”)" },
  { key: "requires_phrase", label: "Must appear with", type: "text", hint: "For “requires”, e.g. above Rs 799" },
  { key: "note", label: "Note", type: "textarea" },
  { key: "severity", label: "Severity", type: "select", options: SEVERITIES },
];

function KnowledgePage() {
  const { data } = useSuspenseQuery(knowledgeQuery);
  const groups = Object.keys(RULE_KINDS).map((k) => ({ kind: k, rows: data.rules.filter((r) => r.kind === k) }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">GreenLeaf Organics</p>
      <h1 className="mt-1 text-3xl font-semibold text-primary-deep md:text-4xl">Brand Knowledge</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Everything the brand check uses. Changes apply to the very next check — no retraining, no AI.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {["#2E7D32", "#F9A825", "#FFFFFF"].map((c) => (
          <div key={c} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
            <span className="h-10 w-10 rounded-xl border border-border" style={{ backgroundColor: c }} />
            <div className="font-mono text-sm">{c}</div>
          </div>
        ))}
      </section>

      <Tabs defaultValue="rules" className="mt-8">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="rules">Guidelines ({data.rules.length})</TabsTrigger>
          <TabsTrigger value="facts">Approved facts ({data.facts.length})</TabsTrigger>
          <TabsTrigger value="terms">Terminology ({data.terms.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-6 space-y-8">
          {groups.map((g) => (
            <div key={g.kind}>
              <h2 className="mb-3 text-lg font-semibold text-primary-deep">{RULE_KINDS[g.kind]}</h2>
              <div className="space-y-2">
                {g.rows.map((r) => (
                  <EditableRow
                    key={r.id}
                    table="brand_rules"
                    row={r as unknown as Row}
                    fields={RULE_FIELDS}
                    title={r.label}
                    subtitle={[r.value && `“${r.value}”`, r.suggestion && `→ ${r.suggestion}`, r.description].filter(Boolean).join("  ·  ")}
                    severity={r.severity}
                  />
                ))}
              </div>
              <AddRow table="brand_rules" fields={RULE_FIELDS} defaults={{ kind: g.kind, severity: "medium", label: "", value: "", suggestion: "", description: "" }} />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="facts" className="mt-6 space-y-2">
          {data.facts.map((f) => (
            <EditableRow
              key={f.id}
              table="approved_facts"
              row={f as unknown as Row}
              fields={FACT_FIELDS}
              title={f.label}
              subtitle={`${f.statement}${f.numeric_value != null ? `  ·  checks ${f.fact_type} = ${f.numeric_value} near “${f.context_terms.join("”, “")}”` : ""}`}
            />
          ))}
          <AddRow
            table="approved_facts"
            fields={FACT_FIELDS}
            defaults={{ label: "", statement: "", fact_type: "text", numeric_value: null, context_terms: [], fact_key: "" }}
          />
        </TabsContent>

        <TabsContent value="terms" className="mt-6 space-y-2">
          {data.terms.map((t) => (
            <EditableRow
              key={t.id}
              table="terminology"
              row={t as unknown as Row}
              fields={TERM_FIELDS}
              title={`Write “${t.preferred}”`}
              subtitle={
                t.rule_type === "requires"
                  ? `Only together with “${t.requires_phrase}”. ${t.note}`
                  : `Not: ${t.incorrect.join(", ")}. ${t.note}`
              }
              severity={t.severity}
            />
          ))}
          <AddRow
            table="terminology"
            fields={TERM_FIELDS}
            defaults={{ preferred: "", rule_type: "replace", incorrect: [], requires_phrase: "", note: "", severity: "medium" }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function toDraft(row: Record<string, unknown>, fields: Field[]) {
  const d: Record<string, string> = {};
  for (const f of fields) {
    const v = row[f.key];
    d[f.key] = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
  }
  return d;
}

function fromDraft(draft: Record<string, string>, fields: Field[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = draft[f.key] ?? "";
    if (f.type === "list") out[f.key] = v.split(",").map((x) => x.trim()).filter(Boolean);
    else if (f.type === "number") out[f.key] = v.trim() === "" ? null : Number(v);
    else out[f.key] = v;
  }
  return out;
}

function useSaver(table: Table) {
  const qc = useQueryClient();
  const { role } = useRole();
  const mutate = useServerFn(mutateKnowledge);
  return async (op: "insert" | "update" | "delete", payload: Record<string, unknown>, id?: string) => {
    await mutate({ data: { table, op, id, role, values: op === "delete" ? undefined : payload } });
    await qc.invalidateQueries({ queryKey: ["knowledge"] });
  };
}

function FieldsForm({
  fields,
  draft,
  setDraft,
}: {
  fields: Field[];
  draft: Record<string, string>;
  setDraft: (d: Record<string, string>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className={f.type === "textarea" ? "space-y-1 sm:col-span-2" : "space-y-1"}>
          <Label className="text-xs">{f.label}</Label>
          {f.type === "textarea" ? (
            <Textarea rows={2} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
          ) : f.type === "select" ? (
            <select
              className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            >
              {f.options!.map((o) => (
                <option key={o} value={o}>
                  {RULE_KINDS[o] ?? o}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={f.type === "number" ? "number" : "text"}
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          )}
          {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function EditableRow({
  table,
  row,
  fields,
  title,
  subtitle,
  severity,
}: {
  table: Table;
  row: Row;
  fields: Field[];
  title: string;
  subtitle: string;
  severity?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(row, fields));
  const [busy, setBusy] = useState(false);
  const save = useSaver(table);

  async function run(op: "update" | "delete") {
    if (op === "delete" && !window.confirm(`Delete “${title}”?`)) return;
    setBusy(true);
    try {
      await save(op, op === "update" ? fromDraft(draft, fields) : {}, row.id);
      toast.success(op === "update" ? "Saved" : "Deleted");
      setEditing(false);
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {title} {severity && <SeverityBadge severity={severity} />}
          </div>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Edit ${title}`}
          onClick={() => {
            setDraft(toDraft(row, fields));
            setEditing(true);
          }}
        >
          <Pencil />
        </Button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-primary bg-card p-4 shadow-lift">
      <FieldsForm fields={fields} draft={draft} setDraft={setDraft} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => run("update")} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => run("delete")} disabled={busy}>
          <Trash2 /> Delete
        </Button>
      </div>
    </div>
  );
}

function AddRow({ table, fields, defaults }: { table: Table; fields: Field[]; defaults: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(defaults, fields));
  const [busy, setBusy] = useState(false);
  const save = useSaver(table);

  async function add() {
    setBusy(true);
    try {
      const payload = fromDraft(draft, fields);
      if (table === "approved_facts" && !payload["fact_key"]) {
        payload["fact_key"] = String(payload["label"] || "fact")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 60) || "fact";
      }
      await save("insert", payload);
      toast.success("Added");
      setDraft(toDraft(defaults, fields));
      setOpen(false);
    } catch (e) {
      toast.error("Could not add", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <Button size="sm" variant="soft" className="mt-2" onClick={() => setOpen(true)}>
        <Plus /> Add
      </Button>
    );
  return (
    <div className="mt-2 rounded-2xl border border-dashed border-primary bg-card p-4">
      <FieldsForm fields={fields} draft={draft} setDraft={setDraft} />
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={add} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Add
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
