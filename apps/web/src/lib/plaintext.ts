/**
 * markdownToPlain — strip README-style markdown into normal wording that
 * copy-pastes cleanly into LinkedIn / Dev.to / docs.
 *
 * Keeps paragraphs, bullets (as •) and code content, but drops #, *, `,
 * links, images, blockquotes, etc.
 */
export function markdownToPlain(md: string): string {
  let s = md ?? "";

  // Fenced code blocks: keep inner content, drop fences + language tag.
  s = s.replace(/```[\w-]*\n?([\s\S]*?)```/g, "$1");

  // Images ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Bare/autolink URLs <https://...> -> https://...
  s = s.replace(/<((?:https?:\/\/)[^>]+)>/g, "$1");

  // Headings: "# Title" -> "Title"
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // Blockquotes: "> text" -> "text"
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  // Horizontal rules
  s = s.replace(/^\s{0,3}([-*_])(\s*\1){2,}\s*$/gm, "");
  // Unordered list markers -> bullet
  s = s.replace(/^(\s*)[-*+]\s+/gm, "$1• ");
  // Ordered list "1. " -> "1. " (keep, already plain)
  // Task lists "- [x]" -> bullet
  s = s.replace(/^(\s*)•\s*\[[ xX]\]\s+/gm, "$1• ");

  // Bold/italic/strikethrough/highlight: **x**, __x__, *x*, _x_, ~~x~~, ==x==, `x`
  s = s.replace(/(\*\*|__)(.*?)\1/g, "$2");
  s = s.replace(/~~(.*?)~~/g, "$1");
  s = s.replace(/==(.*?)==/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  // Leftover single * / _ used as emphasis (avoid mangling words with underscores)
  s = s.replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, "$1$2");
  s = s.replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, "$1$2");

  // Tables: "| a | b |" -> "a  b", drop separator rows
  s = s
    .split("\n")
    .filter((line) => !/^\s*\|?[\s:|-]+\|[\s:|.-]*$/.test(line))
    .map((line) =>
      line.includes("|")
        ? line
            .split("|")
            .map((c) => c.trim())
            .filter(Boolean)
            .join("   ")
        : line
    )
    .join("\n");

  // Collapse 3+ blank lines to a double break, trim trailing spaces.
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}

/** Split long text into Telegram-safe chunks (default 3800 chars, limit 4096). */
export function chunkText(text: string, maxLen = 3800): string[] {
  const t = text ?? "";
  if (t.length <= maxLen) return t ? [t] : [];
  const chunks: string[] = [];
  // Prefer paragraph boundaries.
  const paras = t.split(/\n{2,}/);
  let cur = "";
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (const p of paras) {
    const piece = p.trim();
    if (!piece) continue;
    if ((cur ? cur.length + 2 : 0) + piece.length <= maxLen) {
      cur = cur ? `${cur}\n\n${piece}` : piece;
      continue;
    }
    if (cur) push();
    if (piece.length <= maxLen) {
      cur = piece;
      continue;
    }
    // Hard-split oversized paragraph on line/word boundaries.
    let rest = piece;
    while (rest.length > maxLen) {
      let cut = rest.lastIndexOf("\n", maxLen);
      if (cut < maxLen * 0.5) cut = rest.lastIndexOf(" ", maxLen);
      if (cut <= 0) cut = maxLen;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    cur = rest;
  }
  push();
  return chunks;
}
