/**
 * Spelling & Grammar checks for the BrandLens rule engine. Deterministic, no AI.
 * Spelling uses a caller-supplied dictionary checker (nspell in the browser); grammar is rule-based.
 */
import type { Finding } from "./brand-engine";

export interface SpellChecker {
  correct(word: string): boolean;
  suggest(word: string): string[];
}

const CATEGORY = "Spelling & Grammar" as const;
const MAX_SPELLING = 30;

/** Common words in GreenLeaf copy that general English dictionaries miss. */
const EXTRA_WORDS = [
  "greenleaf", "organics", "almond", "crunch", "ghee", "jaggery", "chai", "masala", "namkeen", "ragi",
  "makhana", "chikki", "diwali", "holi", "rakhi", "laddoo", "ladoo", "millet", "millets", "superfood",
  "superfoods", "snackable", "rs", "inr", "fssai", "npop", "ok", "okay", "online", "app", "eco",
];

type Range = [number, number];

function textFinding(
  ruleRef: string,
  keyPart: string,
  start: number,
  end: number,
  matched: string,
  citation: string,
  explanation: string,
  suggestion: string | null,
): Finding {
  return {
    key: `${ruleRef}|${keyPart.toLowerCase()}`,
    ruleRef,
    category: CATEGORY,
    severity: "low",
    target: "text",
    start,
    end,
    matchedText: matched,
    citation,
    explanation,
    suggestion,
  };
}

/** URLs, emails, hashtags and @mentions are never spell- or grammar-checked. */
export function ignoredRanges(text: string): Range[] {
  const re =
    /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.-]+|[#@][\p{L}\p{N}_-]+|\b[\w-]+\.(?:com|in|org|net|co|io|shop|store)\b(?:\/\S*)?/giu;
  const out: Range[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]);
  return out;
}

const inRanges = (ranges: Range[], start: number, end: number) => ranges.some(([a, b]) => start < b && end > a);

function capitalise(w: string) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function matchCase(source: string, replacement: string) {
  if (/^[A-Z]/.test(source)) return capitalise(replacement);
  return replacement;
}

function isSentenceStart(text: string, pos: number) {
  const before = text.slice(0, pos);
  if (/^[\s"'“‘([]*$/.test(before)) return true;
  if (/\n[\s"'“‘([]*$/.test(before)) return true;
  return /[.!?…]["'”’)\]]*[\s"'“‘([]+$/.test(before);
}

// ---------- Spelling ----------

export function checkSpelling(out: Finding[], text: string, spell: SpellChecker, allow: Set<string>) {
  const ignored = ignoredRanges(text);
  const known = new Set([...EXTRA_WORDS, ...allow]);
  const re = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && count < MAX_SPELLING) {
    const word = m[0];
    const start = m.index;
    const end = start + word.length;
    const prev = text.charAt(start - 1);
    const next = text.charAt(end);
    if (/[\d_]/.test(prev) || /[\d_]/.test(next)) continue; // part of a number/code like 2x or 100g
    if (inRanges(ignored, start, end)) continue;
    if (word.length <= 2) continue;
    if (/^[A-Z]+$/.test(word)) continue; // acronyms and ALL-CAPS (handled by tone rule)
    if (/[a-z][A-Z]/.test(word)) continue; // camelCase brand names
    const normal = word.replace(/’/g, "'");
    const lower = normal.toLowerCase();
    const base = lower.replace(/'s$/, "");
    if (known.has(lower) || known.has(base)) continue;
    // Capitalised words mid-sentence are usually names; don't flag them.
    if (/^[A-Z]/.test(word) && !isSentenceStart(text, start)) continue;
    if (spell.correct(normal) || spell.correct(lower) || spell.correct(base)) continue;
    count++;
    const first = spell.suggest(lower)[0];
    out.push(
      textFinding(
        "spelling",
        lower,
        start,
        end,
        word,
        "Spelling · English dictionary",
        `"${word}" doesn't look like a correctly spelled word. Typos make the brand look careless.`,
        first ? matchCase(word, first) : null,
      ),
    );
  }
}

// ---------- Grammar ----------

const DOUBLE_OK = new Set(["had", "that"]);
const ABBREVIATION_BEFORE = /(?:\b(?:e\.g|i\.e|etc|vs|approx|incl|no|st|dr|mr|mrs|ms|min|max)|\b[a-z]|\.\.)\.$/i;

/** true = vowel sound ("an"), false = consonant sound ("a"), null = not sure (skip). */
function vowelSound(word: string): boolean | null {
  const w = word.toLowerCase();
  if (/^(hour|honest|honou?r|heir)/.test(w)) return true;
  if (/^(one\b|once|eu|ewe)/.test(w)) return false;
  if (/^[aeio]/.test(w)) return true;
  if (/^u/.test(w)) {
    if (/^(uni|una|use|usu|ura|ure|uri|uro|uti|ute|ubi|uk)/.test(w)) return false;
    if (/^(un|up|ug|ul|um|ur|us|ut|ud|ub|ump)/.test(w)) return true;
    return null;
  }
  if (/^[bcdfgjklmnpqrstvwxyz]/.test(w)) return false;
  if (/^h/.test(w)) return false;
  return null;
}

function adjacentWord(text: string, i: number, dir: 1 | -1): Range | null {
  if (dir === 1) {
    const m = /^[A-Za-z0-9'’-]+/.exec(text.slice(i + 1));
    return m ? [i + 1, i + 1 + m[0].length] : null;
  }
  const m = /[A-Za-z0-9'’-]+$/.exec(text.slice(0, i));
  return m ? [i - m[0].length, i] : null;
}

function strayMark(out: Finding[], text: string, i: number, kind: "open" | "close", label: string) {
  const ch = text.charAt(i);
  const word = adjacentWord(text, i, kind === "open" ? 1 : -1);
  const start = word ? Math.min(word[0], i) : i;
  const end = word ? Math.max(word[1], i + 1) : i + 1;
  const matched = text.slice(start, end);
  out.push(
    textFinding(
      `grammar:unmatched-${label}`,
      matched,
      start,
      end,
      matched,
      `Grammar · Unmatched ${label}`,
      kind === "open"
        ? `This ${label === "quote" ? "quotation mark" : "bracket"} (${ch}) is opened but never closed. Close it or remove it.`
        : `This ${label === "quote" ? "quotation mark" : "bracket"} (${ch}) closes something that was never opened.`,
      word ? matched.replace(ch, "") : null,
    ),
  );
}

export function checkGrammar(out: Finding[], text: string) {
  const ignored = ignoredRanges(text);
  let m: RegExpExecArray | null;

  // Repeated words: "the the"
  const rep = /\b([A-Za-z]+)\s+\1\b/gi;
  while ((m = rep.exec(text))) {
    const word = m[1] ?? "";
    if (DOUBLE_OK.has(word.toLowerCase()) || inRanges(ignored, m.index, m.index + m[0].length)) continue;
    out.push(
      textFinding("grammar:repeated-word", m[0], m.index, m.index + m[0].length, m[0], "Grammar · Repeated word",
        `"${word}" is written twice in a row.`, word),
    );
  }

  // Double spaces between words
  // Shown with the neighbouring words so the fix reads clearly ("apple  crunch" -> "apple crunch").
  const dbl = /(\S+)( {2,})(?=(\S+))/g;
  while ((m = dbl.exec(text))) {
    const before = m[1] ?? "";
    const after = m[3] ?? "";
    const end = m.index + m[0].length + after.length;
    const matched = text.slice(m.index, end);
    out.push(
      textFinding("grammar:double-space", matched, m.index, end, matched, "Grammar · Double space",
        "There is more than one space here. Use a single space between words.", `${before} ${after}`),
    );
  }

  // Sentence starting with a lowercase letter
  const low = /(^|[.!?]["'”’)\]]*\s+)(["'“‘(]?)([a-z][A-Za-z'’-]*)/g;
  while ((m = low.exec(text))) {
    const lead = m[1] ?? "";
    const word = m[3] ?? "";
    const start = m.index + lead.length + (m[2] ?? "").length;
    const end = start + word.length;
    if (/[A-Z]/.test(word)) continue; // iPhone-style names
    if (inRanges(ignored, start, end)) continue;
    if (lead && ABBREVIATION_BEFORE.test(text.slice(0, m.index + lead.trimEnd().length).replace(/["'”’)\]]+$/, ""))) continue;
    out.push(
      textFinding("grammar:lowercase-start", word, start, end, word, "Grammar · Capital letter at sentence start",
        "A sentence should start with a capital letter.", capitalise(word)),
    );
  }

  // Missing space after punctuation: "great,and" / "today.Order"
  const gaps = [/([,;:!?])([A-Za-z][A-Za-z'’]*)/g, /(\.)([A-Z][a-z][A-Za-z'’]*)/g];
  for (const re of gaps) {
    while ((m = re.exec(text))) {
      const p = m[1] ?? "";
      const word = m[2] ?? "";
      const end = m.index + m[0].length;
      if (inRanges(ignored, m.index, end)) continue;
      out.push(
        textFinding("grammar:missing-space", m[0], m.index, end, m[0], "Grammar · Space after punctuation",
          `Add a space after "${p}".`, `${p} ${word}`),
      );
    }
  }

  // a / an mismatch
  const art = /\b(a|an)\s+([A-Za-z][A-Za-z'’-]*)/gi;
  while ((m = art.exec(text))) {
    const article = m[1] ?? "";
    const word = m[2] ?? "";
    const end = m.index + m[0].length;
    if (inRanges(ignored, m.index, end)) continue;
    if (word.length < 2 || /^[A-Z]{2,}/.test(word) || /^[A-Za-z]-/.test(word)) continue;
    const vowel = vowelSound(word);
    if (vowel == null) continue;
    const wanted = vowel ? "an" : "a";
    if (article.toLowerCase() === wanted) continue;
    const fixed = `${matchCase(article, wanted)}${m[0].slice(article.length)}`;
    out.push(
      textFinding("grammar:a-an", m[0], m.index, end, m[0], 'Grammar · "a" or "an"',
        `Use "${wanted}" before "${word}" because of how the word sounds.`, fixed),
    );
  }

  // Unmatched brackets and quotation marks
  const stack: Array<{ ch: string; i: number }> = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "”": "“" };
  const straight: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (!"()[]“”\"".includes(ch) || inRanges(ignored, i, i + 1)) continue;
    if (ch === '"') {
      straight.push(i);
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "“") {
      stack.push({ ch, i });
      continue;
    }
    if (ch === ")" && /[:;=]-?$/.test(text.slice(0, i))) continue; // emoticon :)
    if (ch === ")" && /(^|\n)\s*\w{1,2}$/.test(text.slice(0, i))) continue; // list marker "1)"
    const top = stack[stack.length - 1];
    if (top && top.ch === pairs[ch]) stack.pop();
    else strayMark(out, text, i, "close", ch === "”" ? "quote" : "bracket");
  }
  for (const s of stack) strayMark(out, text, s.i, "open", s.ch === "“" ? "quote" : "bracket");
  if (straight.length % 2 === 1) {
    const i = straight[straight.length - 1] ?? 0;
    const opening = !/[A-Za-z0-9.!?,]$/.test(text.slice(0, i));
    strayMark(out, text, i, opening ? "open" : "close", "quote");
  }
}
