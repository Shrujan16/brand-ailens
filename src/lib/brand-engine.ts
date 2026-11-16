/**
 * BrandLens deterministic rule engine. Pure TypeScript, no AI.
 * Given content + brand knowledge, returns findings with exact text ranges,
 * a cited rule/fact, a plain explanation and (when possible) a suggested fix.
 */

export type Severity = "high" | "medium" | "low";
export type FixTarget = "text" | "alt" | "textColor" | "bgColor";

export interface BrandRule {
  id: string;
  kind: string;
  label: string;
  value: string;
  suggestion: string;
  description: string;
  severity: string;
}
export interface ApprovedFact {
  id: string;
  fact_key: string;
  label: string;
  statement: string;
  fact_type: string;
  numeric_value: number | null;
  context_terms: string[];
}
export interface Term {
  id: string;
  preferred: string;
  incorrect: string[];
  rule_type: string;
  requires_phrase: string;
  note: string;
  severity: string;
}
export interface Knowledge {
  rules: BrandRule[];
  facts: ApprovedFact[];
  terms: Term[];
}
export interface CheckInput {
  text: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  textColor?: string | null;
  bgColor?: string | null;
}

export type Category =
  | "Banned word"
  | "Terminology"
  | "Fact mismatch"
  | "Unsupported claim"
  | "Accessibility"
  | "Contrast"
  | "Brand colour"
  | "Tone & readability";

export interface Finding {
  key: string;
  ruleRef: string;
  category: Category;
  severity: Severity;
  target: FixTarget;
  /** Character range in text (only for target "text"; -1 otherwise). */
  start: number;
  end: number;
  matchedText: string;
  citation: string;
  explanation: string;
  suggestion: string | null;
}

const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

function sev(value: string | null | undefined): Severity {
  return value === "high" || value === "low" ? value : "medium";
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive regex for a phrase, with word boundaries on word-character edges. */
export function phraseRegex(phrase: string) {
  const p = phrase.trim();
  const body = p.split(/\s+/).map(escapeRegex).join("\\s+");
  const pre = /^\w/.test(p) ? "(?<![\\w])" : "";
  const post = /\w$/.test(p) ? "(?![\\w])" : "";
  return new RegExp(pre + body + post, "gi");
}

/** Loose regex that also accepts "Rs.", "₹" and "INR" for a "Rs" token. */
function loosePhraseRegex(phrase: string) {
  const tokens = phrase.trim().split(/\s+/).map((t) =>
    /^rs\.?$/i.test(t) ? "(?:rs\\.?|₹|inr)" : escapeRegex(t),
  );
  return new RegExp(tokens.join("\\s*"), "i");
}

function matchCase(source: string, replacement: string) {
  if (!replacement) return replacement;
  if (/^[A-Z]/.test(source)) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

export function splitSentences(text: string): Sentence[] {
  const re = /(?:[^.!?\n]|(?<=\b[Rr]s)\.|\.(?=\d))+[.!?]*/g;
  const out: Sentence[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (!trimmed || !/\w/.test(trimmed)) continue;
    const start = m.index + lead;
    out.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return out;
}

function sentenceAt(sentences: Sentence[], pos: number) {
  return sentences.find((s) => pos >= s.start && pos < s.end);
}

function wordCount(s: string) {
  return s.split(/\s+/).filter((w) => /\w/.test(w)).length;
}

// ---------- Colour helpers ----------
export function parseHex(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function relLuminance([r, g, b]: [number, number, number]) {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(a: string, b: string): number | null {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return null;
  const la = relLuminance(ra);
  const lb = relLuminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function normHex(h: string) {
  const rgb = parseHex(h);
  if (!rgb) return h.toUpperCase();
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function paletteFrom(rules: BrandRule[]) {
  const r = rules.find((x) => x.kind === "visual_palette");
  if (!r) return [] as string[];
  return (r.value.match(/#[0-9a-f]{3,6}\b/gi) ?? []).map(normHex);
}

// ---------- Checks ----------
function pushPhraseFindings(
  out: Finding[],
  text: string,
  rule: BrandRule,
  category: Category,
  prefix: string,
) {
  if (!rule.value.trim()) return;
  const re = phraseRegex(rule.value);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const matched = m[0];
    out.push({
      key: `${prefix}:${rule.value.toLowerCase()}|${matched.toLowerCase()}`,
      ruleRef: `${prefix}:${rule.value}`,
      category,
      severity: sev(rule.severity),
      target: "text",
      start: m.index,
      end: m.index + matched.length,
      matchedText: matched,
      citation: `Brand rule · ${rule.label}`,
      explanation:
        category === "Banned word"
          ? `"${matched}" is on the GreenLeaf banned-words list. ${rule.description}`.trim()
          : `"${matched}" is a claim we cannot back up. ${rule.description}`.trim(),
      suggestion: rule.suggestion ? matchCase(matched, rule.suggestion) : "",
    });
  }
}

function checkTerminology(out: Finding[], text: string, terms: Term[], sentences: Sentence[]) {
  for (const term of terms) {
    if (term.rule_type === "replace") {
      const taken: Array<[number, number]> = [];
      const variants = [...term.incorrect].filter(Boolean).sort((a, b) => b.length - a.length);
      for (const variant of variants) {
        const re = phraseRegex(variant);
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          const start = m.index;
          const end = start + m[0].length;
          if (text.slice(start, start + term.preferred.length) === term.preferred) continue;
          if (taken.some(([a, b]) => start < b && end > a)) continue;
          taken.push([start, end]);
          out.push({
            key: `term:${term.preferred}|${m[0].toLowerCase()}`,
            ruleRef: `term:${term.preferred}`,
            category: "Terminology",
            severity: sev(term.severity),
            target: "text",
            start,
            end,
            matchedText: m[0],
            citation: `Terminology · write "${term.preferred}"`,
            explanation: `"${m[0]}" is not our approved wording. ${term.note}`.trim(),
            suggestion: /^[a-z]/.test(term.preferred) ? matchCase(m[0], term.preferred) : term.preferred,
          });
        }
      }
    } else if (term.rule_type === "requires" && term.requires_phrase.trim()) {
      const re = phraseRegex(term.preferred);
      const req = loosePhraseRegex(term.requires_phrase);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const s = sentenceAt(sentences, m.index);
        const scope = s ? s.text : text;
        if (req.test(scope)) continue;
        out.push({
          key: `term-requires:${term.preferred}|${m[0].toLowerCase()}`,
          ruleRef: `term-requires:${term.preferred}`,
          category: "Terminology",
          severity: sev(term.severity),
          target: "text",
          start: m.index,
          end: m.index + m[0].length,
          matchedText: m[0],
          citation: `Terminology · "${term.preferred}" only with "${term.requires_phrase}"`,
          explanation: `"${m[0]}" must always come with "${term.requires_phrase}". ${term.note}`.trim(),
          suggestion: `${m[0]} ${term.requires_phrase}`,
        });
      }
    }
  }
}

const NUMBER_PATTERNS: Record<string, RegExp> = {
  price: /(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?)/gi,
  year: /\b(1[89]\d{2}|20\d{2})\b/g,
  days: /\b(\d+)\s*-?\s*days?\b/gi,
};

function formatNumber(n: number) {
  return Number.isInteger(n) ? String(n) : String(n);
}

function checkFacts(out: Finding[], text: string, facts: ApprovedFact[], sentences: Sentence[]) {
  const numeric = facts.filter((f) => f.numeric_value != null && NUMBER_PATTERNS[f.fact_type]);
  for (const s of sentences) {
    const lower = s.text.toLowerCase();
    const contexts: Array<{ fact: ApprovedFact; pos: number; end: number }> = [];
    for (const fact of numeric) {
      for (const termRaw of fact.context_terms) {
        const t = termRaw.toLowerCase().trim();
        if (!t) continue;
        let idx = lower.indexOf(t);
        while (idx !== -1) {
          contexts.push({ fact, pos: idx, end: idx + t.length });
          idx = lower.indexOf(t, idx + 1);
        }
      }
    }
    if (!contexts.length) continue;
    for (const type of Object.keys(NUMBER_PATTERNS)) {
      const re = new RegExp(NUMBER_PATTERNS[type].source, NUMBER_PATTERNS[type].flags);
      const candidates = contexts.filter((c) => c.fact.fact_type === type);
      if (!candidates.length) continue;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s.text))) {
        const numStr = m[1];
        const value = parseFloat(numStr.replace(/,/g, ""));
        const numPos = m.index + m[0].lastIndexOf(numStr);
        // Prefer the closest context term written before the number; terms after it are penalised.
        const dist = (c: { pos: number; end: number }) =>
          c.end <= numPos ? numPos - c.end : c.pos - numPos + 40;
        const nearest = candidates.reduce((best, c) => (dist(c) < dist(best) ? c : best));
        const fact = nearest.fact;
        const expected = Number(fact.numeric_value);
        if (value === expected) continue;
        const start = s.start + m.index;
        const replacement =
          m[0].slice(0, m[0].lastIndexOf(numStr)) +
          formatNumber(expected) +
          m[0].slice(m[0].lastIndexOf(numStr) + numStr.length);
        out.push({
          key: `fact:${fact.fact_key}|${m[0].toLowerCase()}`,
          ruleRef: `fact:${fact.fact_key}`,
          category: "Fact mismatch",
          severity: "high",
          target: "text",
          start,
          end: start + m[0].length,
          matchedText: m[0],
          citation: `Approved fact · ${fact.label}: ${fact.statement}`,
          explanation: `You wrote "${m[0]}", but our approved fact says ${formatNumber(expected)}. Publishing a wrong ${type === "price" ? "price" : type === "year" ? "year" : "number"} misleads customers.`,
          suggestion: replacement,
        });
      }
    }
  }
}

function splitSuggestion(sentence: string): string | null {
  const mid = sentence.length / 2;
  const connectors = [", and ", ", but ", ", so ", " because ", ", ", " and "];
  let best: { idx: number; len: number } | null = null;
  for (const c of connectors) {
    let idx = sentence.indexOf(c);
    while (idx !== -1) {
      if (idx > 15 && idx < sentence.length - 15) {
        if (!best || Math.abs(idx - mid) < Math.abs(best.idx - mid)) best = { idx, len: c.length };
      }
      idx = sentence.indexOf(c, idx + 1);
    }
    if (best) break;
  }
  if (!best) return null;
  const before = sentence.slice(0, best.idx).replace(/[,;\s]+$/, "");
  const after = sentence.slice(best.idx + best.len).trim();
  if (!after) return null;
  return `${before}. ${after[0].toUpperCase()}${after.slice(1)}`;
}

const CAPS_ALLOW = new Set(["GST", "FSSAI", "INR", "USDA", "NPOP", "COVID"]);

function checkReadability(out: Finding[], text: string, rules: BrandRule[], sentences: Sentence[]) {
  const tone = rules.find((r) => r.kind === "tone");
  for (const rule of rules.filter((r) => r.kind === "readability")) {
    const max = Number(rule.value);
    if (Number.isFinite(max) && max > 0) {
      for (const s of sentences) {
        const n = wordCount(s.text);
        if (n <= max) continue;
        out.push({
          key: `readability:length|${s.text.slice(0, 40).toLowerCase()}`,
          ruleRef: "readability:length",
          category: "Tone & readability",
          severity: sev(rule.severity),
          target: "text",
          start: s.start,
          end: s.end,
          matchedText: s.text,
          citation: `Brand rule · ${rule.label}`,
          explanation: `This sentence has ${n} words (limit ${max}). ${rule.description}`.trim(),
          suggestion: splitSuggestion(s.text),
        });
      }
    } else if (rule.value) {
      const re = new RegExp(`${escapeRegex(rule.value[0])}{${rule.value.length},}`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        out.push({
          key: `readability:${rule.value}|${m[0]}`,
          ruleRef: `readability:${rule.value}`,
          category: "Tone & readability",
          severity: sev(rule.severity),
          target: "text",
          start: m.index,
          end: m.index + m[0].length,
          matchedText: m[0],
          citation: `Brand rule · ${rule.label}`,
          explanation: rule.description,
          suggestion: rule.suggestion,
        });
      }
    }
  }
  if (tone) {
    const re = /\b[A-Z]{4,}\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (CAPS_ALLOW.has(m[0])) continue;
      out.push({
        key: `tone:caps|${m[0].toLowerCase()}`,
        ruleRef: "tone:caps",
        category: "Tone & readability",
        severity: "low",
        target: "text",
        start: m.index,
        end: m.index + m[0].length,
        matchedText: m[0],
        citation: `Brand rule · ${tone.label}`,
        explanation: "ALL-CAPS reads as shouting. Our tone is warm and simple.",
        suggestion: m[0][0] + m[0].slice(1).toLowerCase(),
      });
    }
  }
}

function checkVisuals(out: Finding[], input: CheckInput, rules: BrandRule[]) {
  const altRule = rules.find((r) => r.kind === "alt_text");
  if (altRule && input.imageUrl) {
    const alt = (input.imageAlt ?? "").trim();
    if (!alt) {
      out.push({
        key: "alt:missing|image",
        ruleRef: "alt:missing",
        category: "Accessibility",
        severity: sev(altRule.severity),
        target: "alt",
        start: -1,
        end: -1,
        matchedText: "Image has no alt text",
        citation: `Brand rule · ${altRule.label}`,
        explanation: `Screen-reader users won't know what this image shows. ${altRule.description}`.trim(),
        suggestion: altRule.suggestion || "Describe the image",
      });
    } else if (alt.length < 8 || /\.(jpe?g|png|webp|gif|svg)$/i.test(alt)) {
      out.push({
        key: `alt:vague|${alt.toLowerCase()}`,
        ruleRef: "alt:vague",
        category: "Accessibility",
        severity: "low",
        target: "alt",
        start: -1,
        end: -1,
        matchedText: `Alt text: "${alt}"`,
        citation: `Brand rule · ${altRule.label}`,
        explanation: "This alt text is too short or looks like a file name. Describe what the image shows.",
        suggestion: altRule.suggestion || null,
      });
    }
  }

  const palette = paletteFrom(rules);
  const contrastRule = rules.find((r) => r.kind === "visual_contrast");
  const fg = input.textColor && parseHex(input.textColor) ? normHex(input.textColor) : null;
  const bg = input.bgColor && parseHex(input.bgColor) ? normHex(input.bgColor) : null;
  if (contrastRule && fg && bg) {
    const min = Number(contrastRule.value) || 4.5;
    const ratio = contrastRatio(fg, bg)!;
    if (ratio < min) {
      const options = [...palette, "#1B3A1D", "#000000", "#FFFFFF"].filter((c) => c !== bg);
      const pick = options.find((c) => (contrastRatio(c, bg) ?? 0) >= min) ?? null;
      out.push({
        key: `contrast:${fg}|${bg}`,
        ruleRef: "visual:contrast",
        category: "Contrast",
        severity: sev(contrastRule.severity),
        target: "textColor",
        start: -1,
        end: -1,
        matchedText: `${fg} text on ${bg} — ${ratio.toFixed(2)}:1`,
        citation: `Brand rule · ${contrastRule.label}`,
        explanation: `Contrast is ${ratio.toFixed(2)}:1, below the ${min}:1 minimum, so text will be hard to read.`,
        suggestion: pick,
      });
    }
  }
  if (palette.length && bg && !palette.includes(bg)) {
    const rgb = parseHex(bg)!;
    const nearest = palette.reduce((best, c) => {
      const d = (x: string) => {
        const p = parseHex(x)!;
        return (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
      };
      return d(c) < d(best) ? c : best;
    });
    out.push({
      key: `palette:${bg}|bg`,
      ruleRef: "visual:palette",
      category: "Brand colour",
      severity: "low",
      target: "bgColor",
      start: -1,
      end: -1,
      matchedText: `Background ${bg} is off-palette`,
      citation: `Brand rule · Brand palette ${palette.join(", ")}`,
      explanation: "Backgrounds should use a GreenLeaf palette colour.",
      suggestion: nearest,
    });
  }
}

function overlaps(a: Finding, b: Finding) {
  return a.start < b.end && a.end > b.start;
}

/** Run every check and return de-duplicated findings ordered by position. */
export function runBrandCheck(input: CheckInput, knowledge: Knowledge): Finding[] {
  const text = input.text ?? "";
  const sentences = splitSentences(text);
  const raw: Finding[] = [];

  for (const rule of knowledge.rules) {
    if (rule.kind === "banned_phrase") pushPhraseFindings(raw, text, rule, "Banned word", "banned");
  }
  for (const rule of knowledge.rules) {
    if (rule.kind === "superlative") pushPhraseFindings(raw, text, rule, "Unsupported claim", "superlative");
  }
  checkTerminology(raw, text, knowledge.terms, sentences);
  checkFacts(raw, text, knowledge.facts, sentences);
  checkReadability(raw, text, knowledge.rules, sentences);

  // De-duplicate overlapping inline findings, keeping the most severe / longest.
  const inline = raw.filter((f) => f.ruleRef !== "readability:length");
  const ordered = [...inline].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      (a.category === "Fact mismatch" ? -1 : 0) - (b.category === "Fact mismatch" ? -1 : 0) ||
      b.end - b.start - (a.end - a.start),
  );
  const kept: Finding[] = [];
  for (const f of ordered) {
    if (kept.some((k) => overlaps(k, f))) continue;
    kept.push(f);
  }
  // A missing-threshold terminology finding is redundant when a fact finding covers that sentence.
  const facts = kept.filter((f) => f.category === "Fact mismatch");
  const finalInline = kept.filter((f) => {
    if (!f.ruleRef.startsWith("term-requires:")) return true;
    const s = sentenceAt(sentences, f.start);
    return !facts.some((x) => s && x.start >= s.start && x.start < s.end);
  });
  const lengths = raw.filter((f) => f.ruleRef === "readability:length");

  const visual: Finding[] = [];
  checkVisuals(visual, input, knowledge.rules);

  const seen = new Set<string>();
  return [...finalInline, ...lengths]
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .concat(visual)
    .filter((f) => {
      const k = `${f.key}@${f.start}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** Replace a finding's text range with the given replacement. */
export function applyTextFix(text: string, finding: Pick<Finding, "start" | "end">, replacement: string) {
  return text.slice(0, finding.start) + replacement + text.slice(finding.end);
}

export const EXAMPLE_CONTENT = {
  title: "Almond Crunch launch post",
  contentType: "Social post",
  text:
    "Green Leaf's new Almond Crunch is the best in India — a guaranteed miracle for just Rs 199!!! " +
    "Enjoy free delivery on every order. " +
    "Every bite is vegan-certified and 100% pure, made by the healthiest snack brand since 2015, and if you don't love it you can send it back within 30 days because we are confident that you will absolutely adore every single crunchy bite we make for you and your whole family. " +
    "ORDER NOW!",
  textColor: "#F9A825",
  bgColor: "#FFFFFF",
};
