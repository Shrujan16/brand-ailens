import { describe, expect, it } from "vitest";
import {
  EXAMPLE_CONTENT,
  applyTextFix,
  contrastRatio,
  runBrandCheck,
  type Knowledge,
} from "@/lib/brand-engine";

const knowledge: Knowledge = {
  rules: [
    { id: "t", kind: "tone", label: "Warm, honest, simple", value: "", suggestion: "", description: "", severity: "low" },
    { id: "b1", kind: "banned_phrase", label: 'No "best in India"', value: "best in India", suggestion: "loved across India", description: "", severity: "high" },
    { id: "b2", kind: "banned_phrase", label: 'No "guaranteed"', value: "guaranteed", suggestion: "thoughtfully made", description: "", severity: "high" },
    { id: "b3", kind: "banned_phrase", label: 'No "miracle"', value: "miracle", suggestion: "wholesome", description: "", severity: "high" },
    { id: "b4", kind: "banned_phrase", label: 'No "cheapest"', value: "cheapest", suggestion: "fairly priced", description: "", severity: "high" },
    { id: "b5", kind: "banned_phrase", label: 'No "#1"', value: "#1", suggestion: "much-loved", description: "", severity: "high" },
    { id: "s1", kind: "superlative", label: "healthiest", value: "healthiest", suggestion: "wholesome", description: "", severity: "medium" },
    { id: "s2", kind: "superlative", label: "best", value: "best", suggestion: "great", description: "", severity: "medium" },
    { id: "p", kind: "visual_palette", label: "Brand palette", value: "#2E7D32, #F9A825, #FFFFFF", suggestion: "", description: "", severity: "low" },
    { id: "c", kind: "visual_contrast", label: "Contrast", value: "4.5", suggestion: "", description: "", severity: "high" },
    { id: "a", kind: "alt_text", label: "Alt text", value: "", suggestion: "GreenLeaf Organics product photo", description: "", severity: "high" },
    { id: "r1", kind: "readability", label: "Under 25 words", value: "25", suggestion: "", description: "", severity: "low" },
    { id: "r2", kind: "readability", label: "One exclamation", value: "!!", suggestion: "!", description: "", severity: "low" },
  ],
  facts: [
    { id: "f1", fact_key: "founded_year", label: "Founded", statement: "Founded in 2019.", fact_type: "year", numeric_value: 2019, context_terms: ["since", "founded"] },
    { id: "f2", fact_key: "delivery_threshold", label: "Free delivery", statement: "Free above Rs 799.", fact_type: "price", numeric_value: 799, context_terms: ["delivery", "shipping"] },
    { id: "f3", fact_key: "almond_crunch_price", label: "Almond Crunch", statement: "Rs 249.", fact_type: "price", numeric_value: 249, context_terms: ["almond crunch"] },
    { id: "f4", fact_key: "return_window", label: "Returns", statement: "7 days.", fact_type: "days", numeric_value: 7, context_terms: ["return", "send it back"] },
  ],
  terms: [
    { id: "g", preferred: "GreenLeaf Organics", incorrect: ["Green Leaf Organics", "Greenleaf Organics", "Green Leaf", "Greenleaf"], rule_type: "replace", requires_phrase: "", note: "", severity: "medium" },
    { id: "v", preferred: "plant-based", incorrect: ["vegan-certified"], rule_type: "replace", requires_phrase: "", note: "", severity: "high" },
    { id: "d", preferred: "free delivery", incorrect: [], rule_type: "requires", requires_phrase: "above Rs 799", note: "", severity: "high" },
  ],
};

const check = (text: string, extra = {}) => runBrandCheck({ text, ...extra }, knowledge);

describe("banned words", () => {
  it("flags each hype word from the brand list", () => {
    const f = check("The cheapest, guaranteed miracle snack, #1 and best in India.");
    const banned = f.filter((x) => x.category === "Banned word").map((x) => x.matchedText.toLowerCase());
    expect(banned).toEqual(["cheapest", "guaranteed", "miracle", "#1", "best in india"]);
  });
  it("does not double-flag 'best' inside 'best in India'", () => {
    const f = check("We are the best in India.");
    expect(f.filter((x) => x.category === "Unsupported claim")).toHaveLength(0);
  });
});

describe("terminology", () => {
  it("accepts the exact brand name", () => {
    expect(check("GreenLeaf Organics makes snacks.").filter((x) => x.category === "Terminology")).toHaveLength(0);
  });
  it("flags Green Leaf and Greenleaf and suggests GreenLeaf Organics", () => {
    const f = check("Green Leaf and Greenleaf are wrong.").filter((x) => x.category === "Terminology");
    expect(f.map((x) => x.matchedText)).toEqual(["Green Leaf", "Greenleaf"]);
    expect(f[0]?.suggestion).toBe("GreenLeaf Organics");
  });
  it("replaces vegan-certified with plant-based", () => {
    const f = check("It is vegan-certified.").find((x) => x.ruleRef === "term:plant-based");
    expect(f?.suggestion).toBe("plant-based");
  });
  it("requires 'above Rs 799' with free delivery", () => {
    expect(check("Enjoy free delivery today.").some((x) => x.ruleRef.startsWith("term-requires"))).toBe(true);
    expect(check("Enjoy free delivery above Rs 799.").some((x) => x.ruleRef.startsWith("term-requires"))).toBe(false);
  });
});

describe("approved facts", () => {
  it("flags a wrong Almond Crunch price and suggests Rs 249", () => {
    const f = check("Almond Crunch is just Rs 199.").find((x) => x.category === "Fact mismatch");
    expect(f?.matchedText).toBe("Rs 199");
    expect(f?.suggestion).toBe("Rs 249");
  });
  it("flags a wrong delivery threshold and suggests Rs 799", () => {
    const f = check("Free delivery above Rs 499.").find((x) => x.category === "Fact mismatch");
    expect(f?.suggestion).toBe("Rs 799");
  });
  it("matches each price to the nearest fact", () => {
    const f = check("Almond Crunch costs Rs 249 and delivery is free above Rs 799.");
    expect(f.filter((x) => x.category === "Fact mismatch")).toHaveLength(0);
  });
  it("flags a wrong founding year and return window", () => {
    const f = check("Loved since 2015. You can return it within 30 days.").filter((x) => x.category === "Fact mismatch");
    expect(f.map((x) => x.suggestion)).toEqual(["2019", "7 days"]);
  });
});

describe("visual and accessibility", () => {
  it("flags an image without alt text", () => {
    expect(check("Hi.", { imageUrl: "x.jpg", imageAlt: "" }).some((x) => x.ruleRef === "alt:missing")).toBe(true);
  });
  it("computes WCAG contrast and flags below 4.5:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    const f = check("Hi.", { textColor: "#F9A825", bgColor: "#FFFFFF" }).find((x) => x.category === "Contrast");
    expect(f).toBeDefined();
    expect(contrastRatio(f!.suggestion!, "#FFFFFF")!).toBeGreaterThanOrEqual(4.5);
  });
  it("passes brand green on white", () => {
    expect(check("Hi.", { textColor: "#2E7D32", bgColor: "#FFFFFF" }).some((x) => x.category === "Contrast")).toBe(false);
  });
});

describe("readability", () => {
  it("flags sentences over 25 words", () => {
    const long = Array.from({ length: 30 }, () => "word").join(" ") + ".";
    expect(check(long).some((x) => x.ruleRef === "readability:length")).toBe(true);
  });
  it("flags repeated exclamation marks", () => {
    expect(check("Wow!!!").find((x) => x.ruleRef === "readability:!!")?.suggestion).toBe("!");
  });
});

describe("example content and fixes", () => {
  it("triggers many findings across categories", () => {
    const f = check(EXAMPLE_CONTENT.text, { textColor: EXAMPLE_CONTENT.textColor, bgColor: EXAMPLE_CONTENT.bgColor, imageUrl: "x", imageAlt: "" });
    const cats = new Set(f.map((x) => x.category));
    expect(f.length).toBeGreaterThanOrEqual(12);
    for (const c of ["Banned word", "Terminology", "Fact mismatch", "Unsupported claim", "Accessibility", "Contrast", "Tone & readability"]) {
      expect(cats.has(c as never)).toBe(true);
    }
  });
  it("accepting a fix applies it to the text", () => {
    const text = "Almond Crunch is just Rs 199.";
    const f = check(text).find((x) => x.category === "Fact mismatch")!;
    const fixed = applyTextFix(text, f, f.suggestion!);
    expect(fixed).toBe("Almond Crunch is just Rs 249.");
    expect(check(fixed).some((x) => x.category === "Fact mismatch")).toBe(false);
  });
});
