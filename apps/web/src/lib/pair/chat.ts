import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { withExponentialBackoff } from "@/lib/ai/retry";
import type { PairArticle, PairSession } from "./sessions";

export type ForcedMode = "chat" | "rewrite" | "critique";

const LIVE_WINDOW = 12;
const SUMMARIZE_AT = 8;

function model() {
  const name = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  return { name, tag: `groq/${name}` };
}

function articleContext(session: PairSession, active: PairArticle): string {
  const parts: string[] = [];
  parts.push(`SESSION MODE: ${session.mode.toUpperCase()}${session.mode === "series" ? " — articles share context; keep voice/terms consistent and cross-reference parts." : " — articles are independent; do not cross-link unless asked."}`);
  parts.push(`PHASE: ${session.phase.toUpperCase()} (plan = converge on angle/outline; draft = write sections; critique = evaluate, don't rewrite unprompted)`);
  parts.push(`CRITIQUE DEPTH: ${session.critiqueDepth === "deep" ? "DEEP-DIVE — section-by-section: what is weak, why, concrete options, what to cut." : "QUICK — top 3 issues + fixes, tight and punchy."}`);
  if (session.mode === "series" && session.articles.length > 1) {
    parts.push(
      `SERIES ARTICLES:\n${session.articles.map((a, n) => `${n + 1}. "${a.title}" [${a.status}]${a.id === active.id ? " (ACTIVE)" : ""}`).join("\n")}`
    );
  }
  if (active.excerpts.length) {
    parts.push(
      `SOURCE EXCERPTS (ground truth — never contradict their facts/claims):\n${active.excerpts.map((e, n) => `[S${n + 1}] ${e.url}\n${e.excerpt.slice(0, 2000)}`).join("\n\n")}`
    );
  }
  if (active.workingBody.trim()) {
    parts.push(`CURRENT WORKING COPY ("${active.title}"):\n${active.workingBody.slice(0, 12000)}`);
  } else {
    parts.push(`No working copy yet for "${active.title}" — plan first, then draft.`);
  }
  return parts.join("\n\n");
}

const PAIR_CONTRACT = `You are a pair-writing partner: a sharp, honest co-author building technical articles WITH the user, turn by turn — like pair programming, but for prose.
- Converse freely: answer, probe with questions, propose angles, push back when the user is wrong or vague.
- If the user's intent is ambiguous (chat vs critique vs rewrite), ASK outright what they want instead of guessing.
- Critique mode: elaborate editorial feedback only — do NOT rewrite the text. Praise specifically, criticize precisely.
- Rewrite mode (only on explicit request): return ONLY the complete revised article in markdown, no commentary wrapper.
- Never invent facts, quotes, numbers, or benchmarks. Attribute sources with links.
- Keep replies focused; match the user's energy. No throat-clearing.`;

/**
 * One pair turn. Returns the assistant reply text (and model tag).
 * History management (append + rolling summary) is the caller's job via
 * appendTurn(); use needsSummary() to decide when to compact.
 */
export async function pairTurn(
  apiKey: string,
  session: PairSession,
  active: PairArticle,
  userMsg: string,
  voiceGuide: string,
  forced: ForcedMode = "chat"
): Promise<{ text: string; model: string }> {
  const groq = createGroq({ apiKey });
  const m = model();

  const recent = session.history.slice(-LIVE_WINDOW);
  const historyBlock = [
    ...(session.historySummary ? [`[Earlier conversation summary]\n${session.historySummary}`] : []),
    ...recent.map((t) => `${t.role === "user" ? "USER" : "PARTNER"}: ${t.text}`),
  ].join("\n\n");

  const forcedBlock =
    forced === "rewrite"
      ? `\nMODE OVERRIDE: REWRITE. Return ONLY the complete revised article in markdown for "${active.title}". No intro, no commentary, no fences around the whole piece.`
      : forced === "critique"
        ? `\nMODE OVERRIDE: CRITIQUE. Give ${session.critiqueDepth === "deep" ? "an elaborate section-by-section editorial critique" : "a tight top-3 critique"} of the working copy. Do NOT rewrite anything.`
        : "";

  const { text } = await withExponentialBackoff(
    () =>
      generateText({
        model: groq(m.name),
        system: `${PAIR_CONTRACT}\n\nAUTHORIAL VOICE GUIDE:\n${voiceGuide}${forcedBlock}`,
        prompt: [
          articleContext(session, active),
          ...(historyBlock ? [`CONVERSATION:\n${historyBlock}`] : []),
          `USER: ${userMsg}`,
          `PARTNER:`,
        ].join("\n\n"),
        maxOutputTokens: forced === "rewrite" ? 4000 : 2000,
      }),
    { maxRetries: 3 }
  );
  return { text: text.trim(), model: m.tag };
}

/** True when enough unsummarized turns piled up beyond the live window. */
export function needsSummary(session: PairSession): boolean {
  return session.history.length - session.summarizedCount - LIVE_WINDOW >= SUMMARIZE_AT;
}

/** Condense older turns into the rolling summary (one extra LLM call). */
export async function compactHistory(
  apiKey: string,
  session: PairSession
): Promise<{ summary: string; summarizedCount: number }> {
  const cutoff = session.history.length - LIVE_WINDOW;
  const chunk = session.history.slice(session.summarizedCount, cutoff);
  if (!chunk.length) return { summary: session.historySummary, summarizedCount: session.summarizedCount };
  const groq = createGroq({ apiKey });
  const m = model();
  const { text } = await withExponentialBackoff(
    () =>
      generateText({
        model: groq(m.name),
        system: `Summarize a co-writing conversation for continuity. Capture: decisions made, agreed angle/outline, open questions, current state of the piece. Under 1500 chars, no fluff.`,
        prompt: [
          ...(session.historySummary ? [`Existing summary:\n${session.historySummary}`] : []),
          `New turns to fold in:\n${chunk.map((t) => `${t.role}: ${t.text.slice(0, 1500)}`).join("\n\n")}`,
        ].join("\n\n"),
        maxOutputTokens: 600,
      }),
    { maxRetries: 2 }
  );
  const merged = session.historySummary
    ? `${session.historySummary}\n${text.trim()}`
    : text.trim();
  return { summary: merged.slice(-4000), summarizedCount: cutoff };
}
