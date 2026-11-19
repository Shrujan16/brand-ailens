import { describe, expect, it } from "vitest";
import type { Knowledge } from "@/lib/brand-engine";
import {
  applyEdits,
  applySingleEdit,
  buildEditInput,
  buildEditInstructions,
  checkEdits,
  parseEdits,
} from "@/lib/edit-recommendations";

const knowledge: Knowledge = {
  rules: [
    { id: "b2", kind: "banned_phrase", label: 'No "guaranteed"', value: "guaranteed", suggestion: "thoughtfully made", description: "", severity: "high" },
  ],
  facts: [
    { id: "f3", fact_key: "almond_crunch_price", label: "Almond Crunch", statement: "Almond Crunch costs Rs 249.", fact_type: "price", numeric_value: 249, context_terms: ["almond crunch"] },
  ],
  terms: [
    { id: "g", preferred: "GreenLeaf Organics", incorrect: ["Green Leaf"], rule_type: "replace", requires_phrase: "", note: "", severity: "medium" },
  ],
};

const draft = "Green Leaf snacks are delicous and guaranteed fresh.";
const json = (edits: unknown[], summary = "Fixed it.") => JSON.stringify({ summary, edits });

describe("edit recommendation prompt", () => {
  it("grounds the model in saved facts, banned words and terminology", () => {
    const p = buildEditInstructions(knowledge);
    expect(p).toContain("Almond Crunch costs Rs 249.");
    expect(p).toContain('Never use: "guaranteed"');
    expect(p).toContain('Write "GreenLeaf Organics" (never: "Green Leaf")');
  });

  it("lists spelling & grammar findings separately from brand-rule findings", () => {
    const input = buildEditInput({ title: "", contentType: "Social post", text: draft }, [
      { category: "Spelling & Grammar", matchedText: "delicous", explanation: "Typo.", citation: "Spelling", suggestion: "delicious" },
      { category: "Banned word", matchedText: "guaranteed", explanation: "Banned.", citation: "Brand rule", suggestion: "thoughtfully made" },
    ]);
    const sg = input.indexOf("Spelling & grammar findings:");
    const brand = input.indexOf("Brand-rule findings:");
    expect(input.indexOf('"delicous"')).toBeGreaterThan(sg);
    expect(input.indexOf('"delicous"')).toBeLessThan(brand);
    expect(input.indexOf('"guaranteed"')).toBeGreaterThan(brand);
    expect(input).toContain('Checker suggestion: "delicious"');
  });
});

describe("parsing edits", () => {
  it("keeps edits whose original appears in the draft, with positions", () => {
    const r = parseEdits(
      json([{ original: "delicous", replacement: "delicious", reason: "Spelling", category: "Spelling & Grammar" }]),
      draft,
    );
    expect(r?.edits).toHaveLength(1);
    expect(r?.edits[0]?.start).toBe(draft.indexOf("delicous"));
  });

  it("drops edits that are not in the draft, unchanged, or overlapping", () => {
    const r = parseEdits(
      json([
        { original: "tasty", replacement: "yummy", reason: "", category: "Tone & readability" },
        { original: "fresh", replacement: "fresh", reason: "", category: "Tone & readability" },
        { original: "guaranteed fresh", replacement: "fresh", reason: "", category: "Banned word" },
        { original: "guaranteed", replacement: "thoughtfully made", reason: "", category: "Banned word" },
      ]),
      draft,
    );
    expect(r?.edits.map((e) => e.original)).toEqual(["guaranteed fresh"]);
  });

  it("returns null for invalid JSON", () => {
    expect(parseEdits("not json", draft)).toBeNull();
  });
});

describe("applying edits", () => {
  it("applies all edits without shifting positions", () => {
    const r = parseEdits(
      json([
        { original: "Green Leaf", replacement: "GreenLeaf Organics", reason: "", category: "Terminology" },
        { original: "delicous", replacement: "delicious", reason: "", category: "Spelling & Grammar" },
        { original: "guaranteed fresh", replacement: "fresh", reason: "", category: "Banned word" },
      ]),
      draft,
    )!;
    expect(applyEdits(draft, r.edits)).toBe("GreenLeaf Organics snacks are delicious and fresh.");
  });

  it("applies a single edit after earlier edits moved the text, and reports missing text", () => {
    const moved = "GreenLeaf Organics snacks are delicous and fresh.";
    expect(applySingleEdit(moved, { original: "delicous", replacement: "delicious", start: 22 })).toBe(
      "GreenLeaf Organics snacks are delicious and fresh.",
    );
    expect(applySingleEdit(moved, { original: "Green Leaf ", replacement: "x", start: 0 })).toBeNull();
  });
});

describe("deterministic guardrail", () => {
  it("warns when an edit still contains a banned word", () => {
    const r = parseEdits(
      json([
        { original: "delicous", replacement: "guaranteed delicious", reason: "", category: "Spelling & Grammar" },
        { original: "Green Leaf", replacement: "GreenLeaf Organics", reason: "", category: "Terminology" },
      ]),
      draft,
    )!;
    const checked = checkEdits(draft, r.edits, knowledge);
    expect(checked.find((e) => e.original === "delicous")?.warning).toContain("Banned word");
    expect(checked.find((e) => e.original === "Green Leaf")?.warning).toBeNull();
  });
});
