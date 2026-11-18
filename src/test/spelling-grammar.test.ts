import { readFileSync } from "node:fs";
import { join } from "node:path";
import nspell from "nspell";
import { describe, expect, it } from "vitest";
import { EXAMPLE_CONTENT, runBrandCheck, type Knowledge, type SpellChecker } from "@/lib/brand-engine";

const dir = join(process.cwd(), "node_modules/dictionary-en");
const dictionary = nspell(readFileSync(join(dir, "index.aff"), "utf8"), readFileSync(join(dir, "index.dic"), "utf8"));
const spell: SpellChecker = { correct: (w) => dictionary.correct(w), suggest: (w) => dictionary.suggest(w) };

const knowledge: Knowledge = {
  rules: [],
  facts: [
    { id: "f3", fact_key: "almond_crunch_price", label: "Almond Crunch", statement: "Rs 249.", fact_type: "price", numeric_value: 249, context_terms: ["almond crunch"] },
  ],
  terms: [
    { id: "g", preferred: "GreenLeaf Organics", incorrect: ["Green Leaf Organics", "Greenleaf"], rule_type: "replace", requires_phrase: "", note: "", severity: "medium" },
    { id: "k", preferred: "Makhanakrisp", incorrect: [], rule_type: "replace", requires_phrase: "", note: "", severity: "low" },
  ],
};

const sg = (text: string, withSpell = true) =>
  runBrandCheck({ text }, knowledge, withSpell ? { spell } : {}).filter((f) => f.category === "Spelling & Grammar");
const refs = (text: string) => sg(text).map((f) => f.ruleRef);

describe("spelling", () => {
  it("flags a misspelled word as low severity with a dictionary suggestion", () => {
    const f = sg("Our snacks are delicous and fresh.");
    expect(f).toHaveLength(1);
    expect(f[0]?.matchedText).toBe("delicous");
    expect(f[0]?.severity).toBe("low");
    expect(f[0]?.suggestion).toBe("delicious");
  });

  it("never flags brand names, terminology, numbers, URLs, hashtags or emojis", () => {
    expect(
      sg("GreenLeaf Organics makes Almond Crunch and Makhanakrisp. Visit greenleaf.in or https://greenleaf.in/shop #snacktime @greenleaf 100g 🌿"),
    ).toEqual([]);
  });

  it("skips spelling when no dictionary is loaded", () => {
    expect(sg("Our snacks are delicous.", false)).toEqual([]);
  });
});

describe("grammar basics", () => {
  it("flags repeated words and suggests one copy", () => {
    const f = sg("We love the the crunch.");
    expect(f.map((x) => x.ruleRef)).toEqual(["grammar:repeated-word"]);
    expect(f[0]?.suggestion).toBe("the");
  });

  it("flags double spaces and suggests a single space", () => {
    const f = sg("Fresh  snacks.");
    expect(f.map((x) => x.ruleRef)).toEqual(["grammar:double-space"]);
    expect(f[0]?.suggestion).toBe("Fresh snacks.");
  });

  it("flags a sentence starting with a lowercase letter", () => {
    const f = sg("Fresh snacks. order today.");
    expect(f.map((x) => x.ruleRef)).toEqual(["grammar:lowercase-start"]);
    expect(f[0]?.suggestion).toBe("Order");
  });

  it("does not treat abbreviations as sentence ends", () => {
    expect(refs("Try our snacks, e.g. roasted makhana.")).toEqual([]);
  });

  it("flags a missing space after punctuation", () => {
    const f = sg("Fresh,crunchy snacks.");
    expect(f.map((x) => x.ruleRef)).toEqual(["grammar:missing-space"]);
    expect(f[0]?.suggestion).toBe(", crunchy");
  });

  it("flags obvious a/an mismatches but not 'a unique' or 'an hour'", () => {
    const f = sg("Grab a apple and an banana.");
    expect(f.map((x) => x.suggestion)).toEqual(["an apple", "a banana"]);
    expect(refs("A unique snack, ready in an hour.")).toEqual([]);
  });

  it("flags unmatched brackets and quotation marks", () => {
    expect(refs("Our snacks (all plant-based are here.")).toEqual(["grammar:unmatched-bracket"]);
    expect(refs('She said "Fresh snacks.')).toEqual(["grammar:unmatched-quote"]);
    expect(refs("Our snacks (all plant-based) are here :)")).toEqual([]);
  });
});

describe("example content", () => {
  it("adds no spelling or grammar noise to the built-in example", () => {
    expect(sg(EXAMPLE_CONTENT.text)).toEqual([]);
  });
});
