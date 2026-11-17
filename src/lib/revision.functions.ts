/**
 * AI revision suggestions (Lovable AI Gateway). The model only proposes copy; the
 * deterministic brand engine re-checks every suggestion before it reaches the creator.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runBrandCheck, type Knowledge } from "./brand-engine";
import { REVISION_SCHEMA, buildRevisionInput, buildRevisionInstructions, parseRevision } from "./revision-prompt";

const MODEL = "openai/gpt-6.1-sol";

const inputSchema = z.object({
  title: z.string().trim().max(200),
  contentType: z.enum(["Social post", "Ad", "Email", "Document"]),
  body: z.string().trim().min(1, "Add some content first.").max(8000, "Drafts must be 8,000 characters or fewer."),
});

export const suggestRevision = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const r = inputSchema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Invalid input");
    return r.data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [rules, facts, terms] = await Promise.all([
      db.from("brand_rules").select("*").order("sort"),
      db.from("approved_facts").select("*").order("created_at"),
      db.from("terminology").select("*").order("created_at"),
    ]);
    if (rules.error || facts.error || terms.error) {
      console.error("[brandlens] load knowledge for revision", rules.error ?? facts.error ?? terms.error);
      throw new Error("Could not load the brand guidelines. Please try again.");
    }
    const knowledge: Knowledge = {
      rules: rules.data,
      facts: facts.data.map((f) => ({ ...f, numeric_value: f.numeric_value == null ? null : Number(f.numeric_value) })),
      terms: terms.data,
    };
    const before = runBrandCheck({ text: data.body }, knowledge).filter((f) => f.target === "text");

    const ai = await import("@lovable.dev/ai-gateway");
    let raw = "";
    try {
      const res = await ai.generateResponse({
        model: MODEL,
        instructions: buildRevisionInstructions(knowledge),
        input: buildRevisionInput({ title: data.title, contentType: data.contentType, text: data.body }, before),
        text: { format: { type: "json_schema", name: "brand_revision", strict: true, schema: REVISION_SCHEMA } },
      });
      for (const item of res.output ?? []) {
        if (item.type !== "message") continue;
        for (const c of item.content) {
          if (c.type === "refusal") throw new Error("The AI declined to revise this draft.");
          if (c.type === "output_text") raw += c.text;
        }
      }
    } catch (e) {
      if (e instanceof ai.PaymentRequiredError)
        throw new Error("AI credits have run out for this workspace. Add credits to keep using suggestions.");
      if (e instanceof ai.RateLimitError)
        throw new Error("Too many suggestion requests right now. Please wait a moment and try again.");
      if (e instanceof ai.GatewayError) {
        console.error("[brandlens] AI revision failed", e.code, e.httpStatus, e.ids);
        throw new Error("The AI suggestion service is unavailable right now. Please try again.");
      }
      throw e;
    }

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
