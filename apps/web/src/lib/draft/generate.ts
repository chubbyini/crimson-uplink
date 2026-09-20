import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { readFile } from "fs/promises";
import { join } from "path";

export interface DraftInput {
  title: string;
  angle: string;
  format: "linkedin" | "x" | "devto";
  sourceUrls: string[];
}

let styleCache: string | null = null;

async function styleGuide(): Promise<string> {
  if (styleCache) return styleCache;
  try {
    styleCache = await readFile(join(process.cwd(), "style.md"), "utf8");
  } catch {
    styleCache = "Write clearly and concretely for developers.";
  }
  return styleCache;
}

/**
 * Groq = voice: turn an approved idea into a publish-ready draft.
 * Caller passes the USER's key (BYOK). Plain generateText — voice needs no
 * schema, which also sidesteps Groq's structured-output limits.
 */
export async function generateDraft(
  apiKey: string,
  idea: DraftInput
): Promise<{ text: string; model: string }> {
  const groq = createGroq({ apiKey });
  const model = "llama-3.3-70b-versatile";
  const style = await styleGuide();

  const { text } = await generateText({
    model: groq(model),
    system: `You are a ghostwriter for a developer. Voice guide:\n${style}`,
    prompt: [
      `Write a ${idea.format} post.`,
      `Working title: ${idea.title}`,
      `Angle (the take — honor it): ${idea.angle}`,
      `Sources (attribute, link the first one):`,
      ...idea.sourceUrls.map((u) => `- ${u}`),
    ].join("\n"),
    maxOutputTokens: 1500,
  });
  return { text: text.trim(), model: `groq/${model}` };
}
