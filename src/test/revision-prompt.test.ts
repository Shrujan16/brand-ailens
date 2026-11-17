import { describe, expect, it } from "vitest";
import type { Knowledge } from "@/lib/brand-engine";
import { buildRevisionInput, buildRevisionInstructions, parseRevision } from "@/lib/revision-prompt";

const knowledge: Knowledge = {
  rules: [
    { id: "b1", kind: "banned_phrase", label: 'No "guaranteed"', value: "guaranteed", suggestion: "thoughtfully made", description: "", severity: "high" },
    { id: "p", kind: "visual_palette", label: "Brand palette", value: "#2E7D32", suggestion: "", description: "", severity: "low" },
  ],
  facts: [
    { id: "f2", fact_key: "delivery_threshold", label: "Free delivery", statement: "Free delivery on orders above Rs 799.", fact_type: "price", numeric_value: 799, context_terms: [] },
    { id: "f3", fact_key: "almond_crunch_price", label: "Almond Crunch", statement: "Almond Crunch costs Rs 249.", fact_type: "price", numeric_value: 249, context_terms: [] },
  ],
  terms: [
    { id: "g", preferred: "GreenLeaf Organics", incorrect: ["Green Leaf"], rule_type: "replace", requires_phrase: "", note: "", severity: "medium" },
  ],
};

describe("AI revision prompt grounding", () => {
  const prompt = buildRevisionInstructions(knowledge);

  it("includes every saved approved fact", () => {
    expect(prompt).toContain("Free delivery on orders above Rs 799.");
    expect(prompt).toContain("Almond Crunch costs Rs 249.");
  });

  it("includes banned phrases and terminology from saved guidelines", () => {
    expect(prompt).toContain('Never use: "guaranteed"');
    expect(prompt).toContain('Write "GreenLeaf Organics" (never: "Green Leaf")');
  });

  it("leaves visual-only rules out of copy guidance", () => {
    expect(prompt).not.toContain("#2E7D32");
  });

  it("passes the rule checker's findings with the draft", () => {
    const input = buildRevisionInput({ title: "T", contentType: "Ad", text: "Guaranteed taste" }, [
      { category: "Banned word", matchedText: "Guaranteed", citation: 'No "guaranteed"', explanation: "Banned." },
    ]);
    expect(input).toContain('[Banned word] "Guaranteed"');
    expect(input).toContain("Guaranteed taste");
  });
});

describe("parseRevision", () => {
  it("rejects replies without revised text", () => {
    expect(parseRevision('{"revised_text":"  ","summary":"","changes":[]}')).toBeNull();
    expect(parseRevision("not json")).toBeNull();
  });

  it("drops no-op changes", () => {
    const r = parseRevision(
      '{"revised_text":"Hi","summary":"s","changes":[{"original":"a","revised":"a","reason":"x"},{"original":"b","revised":"c","reason":"y"}]}',
    );
    expect(r?.changes).toEqual([{ original: "b", revised: "c", reason: "y" }]);
  });
});
