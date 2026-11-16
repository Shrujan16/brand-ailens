export interface HighlightRange {
  id: string;
  start: number;
  end: number;
  severity: string;
}

/** Renders text with non-overlapping ranges wrapped in <mark>. */
export function HighlightedText({
  text,
  ranges,
  activeId,
  onSelect,
}: {
  text: string;
  ranges: HighlightRange[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const sorted = [...ranges].filter((r) => r.start >= 0 && r.end > r.start).sort((a, b) => a.start - b.start);
  const kept: HighlightRange[] = [];
  for (const r of sorted) {
    if (kept.length && r.start < kept[kept.length - 1].end) continue;
    kept.push(r);
  }
  const parts: Array<string | HighlightRange> = [];
  let pos = 0;
  for (const r of kept) {
    if (r.start > pos) parts.push(text.slice(pos, r.start));
    parts.push(r);
    pos = r.end;
  }
  if (pos < text.length) parts.push(text.slice(pos));

  return (
    <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : (
          <mark
            key={i}
            data-active={activeId === p.id}
            data-severity={p.severity}
            className="mark-finding cursor-pointer"
            onClick={() => onSelect?.(p.id)}
          >
            {text.slice(p.start, p.end)}
          </mark>
        ),
      )}
    </p>
  );
}

/** Finds the ranges of matched snippets inside a body of text (for stored findings). */
export function rangesFromSnippets(
  text: string,
  items: Array<{ id: string; matched_text: string; severity: string }>,
): HighlightRange[] {
  const out: HighlightRange[] = [];
  for (const it of items) {
    if (!it.matched_text || it.matched_text.length > 80) continue;
    const idx = text.indexOf(it.matched_text);
    if (idx >= 0) out.push({ id: it.id, start: idx, end: idx + it.matched_text.length, severity: it.severity });
  }
  return out;
}
