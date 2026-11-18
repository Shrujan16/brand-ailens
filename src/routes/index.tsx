import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ImagePlus,
  Loader2,
  Send,
  Sparkles,
  ScanSearch,
  Save,
  Trash2,
  CheckCircle2,
  MessageSquareWarning,
  ArrowDown,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FindingCard } from "@/components/FindingCard";
import { HighlightedText } from "@/components/HighlightedText";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmissionImage } from "@/components/SubmissionImage";
import { AiRevisionPanel } from "@/components/AiRevisionPanel";
import { useServerFn } from "@tanstack/react-start";
import { saveSubmission } from "@/lib/brandlens.functions";
import {
  CONTENT_TYPES,
  knowledgeQuery,
  submissionDetailQuery,
  submissionsQuery,
  uploadImage,
  type Submission,
} from "@/lib/data";
import {
  EXAMPLE_CONTENT,
  applyTextFix,
  contrastRatio,
  runBrandCheck,
  type Finding,
  type SpellChecker,
} from "@/lib/brand-engine";
import { loadSpellChecker } from "@/lib/spellcheck";
import { useRole } from "@/lib/role";
import exampleImage from "@/assets/example-almond-crunch.jpg";

interface Resolution {
  finding: Finding;
  action: "accepted" | "edited" | "dismissed";
  applied?: string;
  reason?: string;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { edit?: string } =>
    typeof search["edit"] === "string" ? { edit: search["edit"] } : {},
  head: () => ({
    meta: [
      { title: "Create & check content — BrandLens" },
      {
        name: "description",
        content: "Paste a post, ad or email and run an instant rules-based brand check for GreenLeaf Organics.",
      },
      { property: "og:title", content: "Create & check content — BrandLens" },
      {
        property: "og:description",
        content: "Paste a post, ad or email and run an instant rules-based brand check for GreenLeaf Organics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(knowledgeQuery),
      context.queryClient.ensureQueryData(submissionsQuery),
    ]),
  component: CreatorPage,
});

const SEVERITY_WEIGHT = { high: 12, medium: 6, low: 2 } as const;

function CreatorPage() {
  const { edit } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role } = useRole();
  const { data: knowledge } = useSuspenseQuery(knowledgeQuery);
  const { data: submissions } = useSuspenseQuery(submissionsQuery);
  const editingDetail = useQuery({ ...submissionDetailQuery(edit ?? "none"), enabled: !!edit });

  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<string>("Social post");
  const [text, setText] = useState("");
  const [imageRef, setImageRef] = useState<string | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [useColors, setUseColors] = useState(false);
  const [textColor, setTextColor] = useState("#2E7D32");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [hasRun, setHasRun] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<null | "draft" | "in_review">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveSubmissionFn = useServerFn(saveSubmission);
  const [spell, setSpell] = useState<SpellChecker | null>(null);

  useEffect(() => {
    let active = true;
    loadSpellChecker()
      .then((s) => active && setSpell(s))
      .catch(() => {
        // Spelling is optional; the other checks still run without the dictionary.
      });
    return () => {
      active = false;
    };
  }, []);

  const editing: Submission | null = edit ? (submissions.find((s) => s.id === edit) ?? null) : null;

  useEffect(() => {
    if (!editing) return;
    setTitle(editing.title);
    setContentType(editing.content_type);
    setText(editing.body);
    setImageRef(editing.image_url);
    setImageAlt(editing.image_alt);
    setUseColors(!!(editing.text_color && editing.bg_color));
    if (editing.text_color) setTextColor(editing.text_color);
    if (editing.bg_color) setBgColor(editing.bg_color);
    setHasRun(false);
    setDismissed(new Set());
    setResolutions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  const input = useMemo(
    () => ({
      text,
      imageUrl: imageRef,
      imageAlt,
      textColor: useColors ? textColor : null,
      bgColor: useColors ? bgColor : null,
    }),
    [text, imageRef, imageAlt, useColors, textColor, bgColor],
  );

  const findings = useMemo(
    () => (hasRun ? runBrandCheck(input, knowledge, { spell }).filter((f) => !dismissed.has(f.key)) : []),
    [hasRun, input, knowledge, dismissed, spell],
  );

  const score = Math.max(0, 100 - findings.reduce((n, f) => n + SEVERITY_WEIGHT[f.severity], 0));
  const counts = {
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  function loadExample() {
    setTitle(EXAMPLE_CONTENT.title);
    setContentType(EXAMPLE_CONTENT.contentType);
    setText(EXAMPLE_CONTENT.text);
    setImageRef(exampleImage);
    setImageAlt("");
    setUseColors(true);
    setTextColor(EXAMPLE_CONTENT.textColor);
    setBgColor(EXAMPLE_CONTENT.bgColor);
    setHasRun(false);
    setDismissed(new Set());
    setResolutions([]);
    if (edit) navigate({ to: "/", search: {} });
    toast("Example loaded", { description: "Press “Run Brand Check” to see what BrandLens catches." });
  }

  function resetForm() {
    setTitle("");
    setText("");
    setImageRef(null);
    setImageAlt("");
    setUseColors(false);
    setHasRun(false);
    setDismissed(new Set());
    setResolutions([]);
    navigate({ to: "/", search: {} });
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadImage(file);
      setImageRef(path);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  function runCheck() {
    const found = runBrandCheck(input, knowledge, { spell }).filter((f) => !dismissed.has(f.key));
    setHasRun(true);
    const by = (s: Finding["severity"]) => found.filter((f) => f.severity === s).length;
    window.__lovableEvents?.track?.("project.brand_check_run", {
      content_type: contentType,
      open_findings: found.length,
      high: by("high"),
      medium: by("medium"),
      low: by("low"),
      score: Math.max(0, 100 - found.reduce((n, f) => n + SEVERITY_WEIGHT[f.severity], 0)),
    });
  }

  function trackResolution(f: Finding, action: Resolution["action"]) {
    window.__lovableEvents?.track?.("project.finding_resolved", {
      action,
      category: f.category,
      severity: f.severity,
    });
  }

  function applyAiRevision(revised: string) {
    setText(revised);
    setHasRun(true);
    setDismissed(new Set());
    setResolutions([]);
    toast.success("Revision applied", { description: "Findings now reflect the revised draft." });
  }

  function applyFinding(f: Finding, value: string, action: "accepted" | "edited") {
    if (f.target === "text") setText((t) => applyTextFix(t, f, value));
    else if (f.target === "alt") setImageAlt(value);
    else if (f.target === "textColor") setTextColor(value);
    else if (f.target === "bgColor") setBgColor(value);
    setResolutions((r) => [...r, { finding: f, action, applied: value }]);
    trackResolution(f, action);
  }

  function dismissFinding(f: Finding, reason: string) {
    setDismissed((d) => new Set(d).add(f.key));
    setResolutions((r) => [...r, { finding: f, action: "dismissed", reason }]);
    trackResolution(f, "dismissed");
  }

  async function save(status: "draft" | "in_review") {
    if (!text.trim()) {
      toast.error("Add some content first.");
      return;
    }
    setSaving(status);
    try {
      const current = runBrandCheck(input, knowledge, { spell }).filter((f) => !dismissed.has(f.key));
      setHasRun(true);
      const base = {
        title: title.trim() || "Untitled",
        content_type: contentType as (typeof CONTENT_TYPES)[number],
        body: text,
        image_url: imageRef,
        image_alt: imageAlt,
        text_color: useColors ? textColor : null,
        bg_color: useColors ? bgColor : null,
        status,
      };
      const findingRows = [
        ...current.map((f) => ({
          rule_ref: f.ruleRef,
          category: f.category,
          severity: f.severity,
          matched_text: f.matchedText,
          citation: f.citation,
          explanation: f.explanation,
          suggestion: f.suggestion,
          status: "open" as const,
          dismiss_reason: null,
        })),
        ...resolutions.map((r) => ({
          rule_ref: r.finding.ruleRef,
          category: r.finding.category,
          severity: r.finding.severity,
          matched_text: r.finding.matchedText,
          citation: r.finding.citation,
          explanation: r.finding.explanation,
          suggestion: r.applied ?? r.finding.suggestion,
          status: r.action,
          dismiss_reason: r.reason ?? null,
        })),
      ];
      const { id, revision, open } = await saveSubmissionFn({
        data: { ...base, editId: editing?.id ?? null, role, findings: findingRows },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["submissions"] }),
        qc.invalidateQueries({ queryKey: ["findings"] }),
        qc.invalidateQueries({ queryKey: ["submission", id] }),
      ]);
      if (status === "in_review") {
        window.__lovableEvents?.track?.("project.submission_sent", {
          content_type: base.content_type,
          revision,
          is_resubmission: revision > 1,
          open_findings: open,
          resolved_findings: resolutions.length,
        });
        toast.success("Sent to the Reviewer queue", {
          description: `${current.length} open finding(s) included.`,
        });
        navigate({ to: "/review/$id", params: { id } });
      } else {
        toast.success("Draft saved");
        navigate({ to: "/", search: { edit: id } });
      }
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
    } finally {
      setSaving(null);
    }
  }

  const ranges = findings
    .filter((f) => f.target === "text" && f.ruleRef !== "readability:length")
    .map((f) => ({ id: f.key, start: f.start, end: f.end, severity: f.severity }));
  const ratio = useColors ? contrastRatio(textColor, bgColor) : null;
  const latestChangeRequest = editingDetail.data?.comments.filter((c) => c.author_role === "reviewer").at(-1);

  return (
    <div className="bg-leaf">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <section className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Creator studio</p>
            <h1 className="mt-1 text-3xl font-semibold text-primary-deep md:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {editing ? `Revising “${editing.title}”` : "Catch the errors in your content before your audience does."}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Paste your post, ad or email before you publish. BrandLens checks it against your brand rules, approved
              facts and terminology, and flags mistakes, brand issues and exaggerated claims, so you don’t get called
              out later.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {!editing && (
                <Button variant="hero" asChild>
                  <a href="#checker">
                    <ArrowDown /> Start checking
                  </a>
                </Button>
              )}
              <Button variant="harvest" onClick={loadExample}>
                <Sparkles /> Load example
              </Button>
              {(editing || text) && (
                <Button variant="ghost" onClick={resetForm}>
                  <Trash2 /> Clear
                </Button>
              )}
            </div>
          </div>
          {!editing && (
            <aside className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Who is this for?</h2>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Built for the marketing, advertising and social-media teams of GreenLeaf Organics, a demo brand created
                for this hackathon. It is an internal brand-governance tool, open to judges for evaluation.
              </p>
            </aside>
          )}
        </section>

        {!editing && <HowItWorks />}

        {editing && editing.status === "changes_requested" && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sev-high/30 bg-sev-high-soft p-4 text-sm">
            <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-sev-high" />
            <div>
              <div className="font-semibold text-foreground">The reviewer requested changes</div>
              {latestChangeRequest && <p className="mt-1 text-muted-foreground">“{latestChangeRequest.body}”</p>}
              <p className="mt-1 text-muted-foreground">
                Resubmitting creates revision {editing.revision + 1}.
              </p>
            </div>
          </div>
        )}

        <div id="checker" className="grid scroll-mt-20 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Editor */}
          <section className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali snack box post" />
              </div>
              <div className="space-y-1.5">
                <Label>Content type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger aria-label="Content type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="body">Content</Label>
              <Textarea
                id="body"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your post, ad, email or document text here…"
                rows={8}
                className="text-[15px] leading-7"
              />
              <p className="text-xs text-muted-foreground">{text.trim() ? text.trim().split(/\s+/).length : 0} words</p>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <Label>Image (optional)</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                />
                <div className="flex gap-2">
                  {imageRef && (
                    <Button size="sm" variant="ghost" onClick={() => setImageRef(null)}>
                      Remove
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                    {imageRef ? "Replace" : "Upload image"}
                  </Button>
                </div>
              </div>
              {imageRef && (
                <div className="flex gap-3">
                  <SubmissionImage src={imageRef} alt={imageAlt} className="h-20 w-28 shrink-0 rounded-lg object-cover" />
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="alt">Alt text</Label>
                    <Input
                      id="alt"
                      value={imageAlt}
                      onChange={(e) => setImageAlt(e.target.value)}
                      placeholder="Describe what the image shows"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="colors">Text-on-colour design (optional)</Label>
                <Switch id="colors" checked={useColors} onCheckedChange={setUseColors} />
              </div>
              {useColors && (
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <ColorField label="Text colour" value={textColor} onChange={setTextColor} />
                  <ColorField label="Background" value={bgColor} onChange={setBgColor} />
                  <div
                    className="flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm font-semibold"
                    style={{ color: textColor, backgroundColor: bgColor }}
                  >
                    Aa {ratio ? `${ratio.toFixed(1)}:1` : ""}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" variant="hero" className="flex-1" onClick={runCheck} disabled={!text.trim()}>
                <ScanSearch /> Run Brand Check
              </Button>
              <Button size="lg" variant="outline" onClick={() => save("draft")} disabled={!!saving || !text.trim()}>
                {saving === "draft" ? <Loader2 className="animate-spin" /> : <Save />} Save draft
              </Button>
            </div>

            <AiRevisionPanel title={title} contentType={contentType} text={text} onApply={applyAiRevision} />

            {hasRun && (
              <div className="rounded-2xl border border-border p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Highlighted preview
                </div>
                <HighlightedText
                  text={text}
                  ranges={ranges}
                  activeId={activeKey}
                  onSelect={(id) => {
                    setActiveKey(id);
                    document.getElementById(`finding-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                />
              </div>
            )}
          </section>

          {/* Findings */}
          <section className="space-y-4">
            {!hasRun ? (
              <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
                <ScanSearch className="h-10 w-10 text-primary" />
                <h2 className="mt-3 text-xl font-semibold text-primary-deep">Findings appear here</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Paste content (or load the example) and press Run Brand Check. Each issue cites the rule or fact it
                  breaks.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-lift">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Brand score</div>
                      <div className="font-display text-5xl font-semibold">{score}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {(["high", "medium", "low"] as const).map((s) => (
                        <div key={s} className="rounded-xl bg-primary-foreground/15 px-3 py-2">
                          <div className="font-display text-2xl font-semibold">{counts[s]}</div>
                          <div className="capitalize opacity-80">{s}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {resolutions.length > 0 && (
                    <p className="mt-3 text-xs opacity-85">
                      {resolutions.filter((r) => r.action !== "dismissed").length} fixed ·{" "}
                      {resolutions.filter((r) => r.action === "dismissed").length} dismissed
                    </p>
                  )}
                </div>

                {findings.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-success-soft p-4 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>No open issues. This content follows the GreenLeaf brand rules.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {findings.map((f) => (
                      <FindingCard
                        key={`${f.key}@${f.start}`}
                        finding={f}
                        text={text}
                        active={activeKey === f.key}
                        onFocus={() => setActiveKey(f.key)}
                        onAccept={() => applyFinding(f, f.suggestion ?? "", "accepted")}
                        onEdit={(v) => applyFinding(f, v, "edited")}
                        onDismiss={(reason) => dismissFinding(f, reason)}
                      />
                    ))}
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => save("in_review")}
                  disabled={!!saving || !text.trim()}
                >
                  {saving === "in_review" ? <Loader2 className="animate-spin" /> : <Send />}
                  Submit for review
                  {findings.length > 0 && ` (${findings.length} open)`}
                </Button>
              </>
            )}
          </section>
        </div>

        {!editing && <CheckCoverage />}

        <RecentSubmissions submissions={submissions} />
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} picker`}
          className="h-9 w-10 cursor-pointer rounded-md border border-input bg-card p-1"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} hex`} className="font-mono uppercase" />
      </div>
    </div>
  );
}

function RecentSubmissions({ submissions }: { submissions: Submission[] }) {
  if (!submissions.length) return null;
  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-semibold text-primary-deep">Recent submissions</h2>
        <Button asChild size="sm" variant="ghost">
          <Link to="/review">
            View all <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {submissions.slice(0, 3).map((s) => (
          <div key={s.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-foreground">{s.title}</div>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {s.content_type} · revision {s.revision}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.body}</p>
            <div className="mt-3 flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/review/$id" params={{ id: s.id }}>
                  Open
                </Link>
              </Button>
              {(s.status === "draft" || s.status === "changes_requested") && (
                <Button asChild size="sm" variant="soft">
                  <Link to="/" search={{ edit: s.id }}>
                    Revise
                  </Link>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  "Paste or upload your content.",
  "Run Brand Check and review each finding.",
  "Fix it, submit for review, and a reviewer approves.",
];

function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="mb-6">
      <h2 id="how-it-works" className="sr-only">
        How it works
      </h2>
      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <span className="text-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const COVERAGE: Array<{ status: "Available" | "Planned" | "Not supported yet"; label: string }> = [
  { status: "Available", label: "Text (captions, posts, ads, emails): full checks" },
  { status: "Available", label: "Images: alt text and text-on-colour contrast" },
  { status: "Planned", label: "Poster checks (logo, brand colours, text inside images)" },
  { status: "Not supported yet", label: "Video" },
];

const STATUS_STYLE = {
  Available: "bg-success-soft text-primary-deep border-primary/30",
  Planned: "bg-harvest-soft text-harvest-foreground border-harvest/40",
  "Not supported yet": "bg-muted text-muted-foreground border-border",
} as const;

const CHECKS = [
  ["Brand voice", "wording and tone that sound like the brand (no hype like “best in India”)."],
  ["Facts", "prices, delivery terms and dates must match the approved facts."],
  ["Terminology", "brand and product names written correctly."],
  ["Visual", "alt text and readable colours."],
  ["Claims", "exaggerated or unsupported claims such as “guaranteed”."],
  ["Spelling and grammar", "typing mistakes and basic grammar slips."],
] as const;

function CheckCoverage() {
  return (
    <section className="mt-12 grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
        <h2 className="text-xl font-semibold text-primary-deep">What can it check?</h2>
        <ul className="mt-4 space-y-2.5">
          {COVERAGE.map((c) => (
            <li key={c.label} className="flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:gap-3">
              <span
                className={`inline-flex w-fit shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[c.status]}`}
              >
                {c.status}
              </span>
              <span className="text-foreground">{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
        <h2 className="text-xl font-semibold text-primary-deep">What does BrandLens check?</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {CHECKS.map(([name, text]) => (
            <li key={name} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="font-semibold text-foreground">{name}:</span>{" "}
                <span className="text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
          BrandLens checks against the company’s own rules. It is not legal advice; legal and regulatory checks are
          planned. A human reviewer always makes the final decision.
        </p>
      </div>
    </section>
  );
}
