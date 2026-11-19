/**
 * AI assistance (Lovable AI Gateway). The model only proposes copy or edits; the
 * deterministic brand engine re-checks every suggestion before it reaches the creator.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runBrandCheck, type Knowledge } from "./brand-engine";
import { REVISION_SCHEMA, buildRevisionInput, buildRevisionInstructions, parseRevision } from "./revision-prompt";
import { EDITS_SCHEMA, applyEdits, buildEditInput, buildEditInstructions, checkEdits, parseEdits } from "./edit-recommendations";

const MODEL = "openai/gpt-6.1-sol";

const inputSchema = z.object({
  title: z.string().trim().max(200),
  contentType: z.enum(["Social post", "Ad", "Email", "Document"]),
  body: z.string().trim().min(1, "Add some content first.").max(8000, "Drafts must be 8,000 characters or fewer."),
});

async function loadKnowledge(): Promise<Knowledge> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [rules, facts, terms] = await Promise.all([
    db.from("brand_rules").select("*").order("sort"),
    db.from("approved_facts").select("*").order("created_at"),
    db.from("terminology").select("*").order("created_at"),
  ]);
  if (rules.error || facts.error || terms.error) {
    console.error("[brandlens] load knowledge for AI", rules.error ?? facts.error ?? terms.error);
    throw new Error("Could not load the brand guidelines. Please try again.");
  }
  return {
    rules: rules.data,
    facts: facts.data.map((f) => ({ ...f, numeric_value: f.numeric_value == null ? null : Number(f.numeric_value) })),
    terms: terms.data,
  };
}

/** Calls the model with a strict JSON schema and returns the raw JSON text. */
async function callModel(
  instructions: string,
  input: string,
  name: string,
  schema: typeof REVISION_SCHEMA | typeof EDITS_SCHEMA,
): Promise<string> {
  const ai = await import("@lovable.dev/ai-gateway");
  let raw = "";
  try {
    const res = await ai.generateResponse({
      model: MODEL,
      instructions,
      input,
      text: { format: { type: "json_schema", name, strict: true, schema } },
    });
    for (const item of res.output ?? []) {
      if (item.type !== "message") continue;
      for (const c of item.content) {
        if (c.type === "refusal") throw new Error("The AI declined to work on this draft.");
        if (c.type === "output_text") raw += c.text;
      }
    }
  } catch (e) {
    if (e instanceof ai.PaymentRequiredError)
      throw new Error("AI credits have run out for this workspace. Add credits to keep using suggestions.");
    if (e instanceof ai.RateLimitError)
      throw new Error("Too many suggestion requests right now. Please wait a moment and try again.");
    if (e instanceof ai.GatewayError) {
      console.error("[brandlens] AI request failed", name, e.code, e.httpStatus, e.ids);
      throw new Error("The AI suggestion service is unavailable right now. Please try again.");
    }
    throw e;
  }
  return raw;
}

export const suggestRevision = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const r = inputSchema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Invalid input");
    return r.data;
  })
  .handler(async ({ data }) => {
    const knowledge = await loadKnowledge();
    const before = runBrandCheck({ text: data.body }, knowledge).filter((f) => f.target === "text");
    const raw = await callModel(
      buildRevisionInstructions(knowledge),
      buildRevisionInput({ title: data.title, contentType: data.contentType, text: data.body }, before),
      "brand_revision",
      REVISION_SCHEMA,
    );

    const parsed = parseRevision(raw);
    if (!parsed) throw new Error("The AI returned an unusable suggestion. Please try again.");

    // Guardrail: re-run the deterministic checker on the suggestion.
    const after = runBrandCheck({ text: parsed.revisedText }, knowledge).filter((f) => f.target === "text");
    return {
      ...parsed,
      issuesBefore: before.length,
      remaining: after.map((f) => ({ category: f.category, severity: f.severity, matchedText: f.matchedText })),
    };
  });

// Spelling runs in the browser (the dictionary is client-only), so the creator sends those findings.
// Brand and grammar findings are always recomputed here from the saved Brand Knowledge.
const spellingFinding = z.object({
  matchedText: z.string().min(1).max(100),
  suggestion: z.string().max(100).nullable(),
});

export const recommendEdits = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const r = inputSchema.extend({ spelling: z.array(spellingFinding).max(40) }).safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Invalid input");
    return r.data;
  })
  .handler(async ({ data }) => {
    const knowledge = await loadKnowledge();
    const brand = runBrandCheck({ text: data.body }, knowledge).filter((f) => f.target === "text");
    const spelling = data.spelling
      .filter((s) => data.body.includes(s.matchedText) && !brand.some((b) => b.matchedText.includes(s.matchedText)))
      .map((s) => ({
        category: "Spelling & Grammar" as const,
        matchedText: s.matchedText,
        explanation: `"${s.matchedText}" doesn't look like a correctly spelled word.`,
        citation: "Spelling · English dictionary",
        suggestion: s.suggestion,
      }));
    const findings = [...spelling, ...brand];
    if (!findings.length) return { summary: "", edits: [], ruleIssuesBefore: 0, ruleIssuesAfter: 0, spellingIssues: 0 };

    const raw = await callModel(
      buildEditInstructions(knowledge),
      buildEditInput({ title: data.title, contentType: data.contentType, text: data.body }, findings),
      "brand_edits",
      EDITS_SCHEMA,
    );
    const parsed = parseEdits(raw, data.body);
    if (!parsed) throw new Error("The AI returned unusable edits. Please try again.");

    // Guardrail: re-check every edit and the fully edited draft with the deterministic engine.
    const edits = checkEdits(data.body, parsed.edits, knowledge);
    const after = runBrandCheck({ text: applyEdits(data.body, edits) }, knowledge).filter((f) => f.target === "text");
    return {
      summary: parsed.summary,
      edits,
      ruleIssuesBefore: brand.length,
      ruleIssuesAfter: after.length,
      spellingIssues: spelling.length,
    };
  });
