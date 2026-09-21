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
 * Groq = voice: turn an approved idea into a publish-ready, article-level draft.
 * Caller passes the USER's key (BYOK). Plain generateText — voice needs no
 * schema, which also sidesteps Groq's structured-output limits.
 */
export async function generateDraft(
  apiKey: string,
  idea: DraftInput
): Promise<{ text: string; model: string }> {
  const groq = createGroq({ apiKey });
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const style = await styleGuide();

  const { text } = await generateText({
    model: groq(model),
    system: `You are a technical ghostwriter and expert author for software developers. Voice guide:\n${style}`,
    prompt: [
      `Write an IN-DEPTH, FULL-LENGTH, ARTICLE-LEVEL post for ${idea.format}.`,
      `CRITICAL REQUIREMENTS:`,
      `- Do NOT write a small post or brief summary. Write a comprehensive, detailed, article-level piece (800–1500+ words).`,
      `- Include clear structural elements: an engaging headline, an executive summary/introduction, detailed main sections with markdown headers (## Section Name), in-depth technical analysis, concrete code snippets or architecture breakdowns where relevant, practical step-by-step guidance, actionable takeaways, and a solid conclusion.`,
      `- Tone: Practitioner-focused, authoritative, concrete, and highly readable.`,
      ``,
      `Working title: ${idea.title}`,
      `Angle (the core take — honor it deeply): ${idea.angle}`,
      `Sources to reference or attribute (link where applicable):`,
      ...(idea.sourceUrls.length ? idea.sourceUrls.map((u) => `- ${u}`) : ["- (Topic-based deep dive)"]),
    ].join("\n"),
    maxOutputTokens: 4000,
  });
  return { text: text.trim(), model: `groq/${model}` };
}

/**
 * Groq = AI Editor: refine an existing article draft using specific user instructions.
 */
export async function editDraftWithGroq(
  apiKey: string,
  currentBody: string,
  instruction: string
): Promise<{ text: string; model: string }> {
  const groq = createGroq({ apiKey });
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const style = await styleGuide();

  const { text } = await generateText({
    model: groq(model),
    system: `You are an expert technical editor for developers. Voice guide:\n${style}`,
    prompt: [
      `Modify and refine the following draft according strictly to the user's editing instructions.`,
      `Maintain article-level depth, clear markdown formatting (headers, code snippets), and high technical quality.`,
      ``,
      `--- CURRENT DRAFT ---`,
      currentBody,
      ``,
      `--- EDITING INSTRUCTIONS ---`,
      instruction,
      ``,
      `Return ONLY the complete updated article in markdown format, without any surrounding conversational wrapper or meta-text.`,
    ].join("\n"),
    maxOutputTokens: 4000,
  });
  return { text: text.trim(), model: `groq/${model}` };
}

