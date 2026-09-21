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

const styleCache = new Map<string, { text: string; at: number }>();
const STYLE_TTL_MS = 5 * 60 * 1000;

async function styleGuide(cacheKey = "global"): Promise<string> {
  const hit = styleCache.get(cacheKey);
  if (hit && Date.now() - hit.at < STYLE_TTL_MS) return hit.text;
  let text: string;
  try {
    text = await readFile(join(process.cwd(), "style.md"), "utf8");
  } catch {
    text = "Write clearly and concretely for developers.";
  }
  styleCache.set(cacheKey, { text, at: Date.now() });
  return text;
}

/** For tests / per-user voice: allow explicit cache seeding + clearing. */
export function __setStyleCacheForTest(key: string, text: string) {
  styleCache.set(key, { text, at: Date.now() });
}
export function __clearStyleCacheForTest() {
  styleCache.clear();
}

/**
 * Groq = voice: turn an approved idea into a publish-ready, article-level draft.
 * Caller passes the USER's key (BYOK). Plain generateText — voice needs no
 * schema, which also sidesteps Groq's structured-output limits.
 */
import { withExponentialBackoff } from "@/lib/ai/retry";

export async function generateDraft(
  apiKey: string,
  idea: DraftInput,
  customVoiceGuide?: string
): Promise<{ text: string; model: string }> {
  const groq = createGroq({ apiKey });
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const style = customVoiceGuide || (await styleGuide());

  const { text } = await withExponentialBackoff(
    async () =>
      generateText({
        model: groq(model),
        system: `You are a technical ghostwriter and expert author for software developers.\n\nAUTHORIAL VOICE GUIDE:\n${style}`,
        prompt: [
          `Write an IN-DEPTH, FULL-LENGTH, ARTICLE-LEVEL post for ${idea.format}.`,
          `CRITICAL REQUIREMENTS:`,
          `- Do NOT write a small post or brief summary. Write a comprehensive, detailed, article-level piece (800–1500+ words).`,
          `- Include clear structural elements: an engaging headline, an executive summary/introduction, detailed main sections with markdown headers (## Section Name), in-depth technical analysis, concrete code snippets or architecture breakdowns where relevant, practical step-by-step guidance, actionable takeaways, and a solid conclusion.`,
          `- Tone: Honor the authorial voice guide strictly.`,
          ``,
          `Working title: ${idea.title}`,
          `Angle (the core take — honor it deeply): ${idea.angle}`,
          `Sources to reference or attribute (link where applicable):`,
          ...(idea.sourceUrls.length ? idea.sourceUrls.map((u) => `- ${u}`) : ["- (Topic-based deep dive)"]),
        ].join("\n"),
        maxOutputTokens: 4000,
      }),
    { maxRetries: 3 }
  );
  return { text: text.trim(), model: `groq/${model}` };
}

/**
 * Groq = AI Editor: refine an existing article draft using specific user instructions.
 */
export async function editDraftWithGroq(
  apiKey: string,
  currentBody: string,
  instruction: string,
  customVoiceGuide?: string
): Promise<{ text: string; model: string }> {
  const groq = createGroq({ apiKey });
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const style = customVoiceGuide || (await styleGuide());

  const { text } = await withExponentialBackoff(
    async () =>
      generateText({
        model: groq(model),
        system: `You are an expert technical editor for developers.\n\nAUTHORIAL VOICE GUIDE:\n${style}`,
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
      }),
    { maxRetries: 3 }
  );
  return { text: text.trim(), model: `groq/${model}` };
}

/**
 * Groq = LinkedIn Specialist: transform a draft article into a 3000-character LinkedIn post.
 */
export async function refineForLinkedin(
  apiKey: string,
  title: string,
  body: string,
  customVoiceGuide?: string
): Promise<{ text: string; model: string }> {
  const groq = createGroq({ apiKey });
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const style = customVoiceGuide || (await styleGuide());

  const { text } = await withExponentialBackoff(
    async () =>
      generateText({
        model: groq(model),
        system: `You are a top-tier LinkedIn tech influencer and developer ghostwriter.\n\nAUTHORIAL VOICE GUIDE:\n${style}`,
        prompt: [
          `Transform the following technical article into a high-performing, ready-to-post LinkedIn update.`,
          ``,
          `STRICT LINKEDIN CONSTRAINTS & FORMATTING:`,
          `1. CHARACTER LIMIT: The total text MUST be STRICTLY UNDER 3000 CHARACTERS (target range: 1800–2700 characters). Never exceed 3000 characters.`,
          `2. HOOK: Start with a powerful, single-line attention-grabbing hook in sentence 1. Do NOT start with "# Title".`,
          `3. SPACING: Use short 1-2 sentence paragraphs with clear double line breaks for mobile readability.`,
          `4. BULLETS: Use clean bullet points (• or ⚡) for key takeaways or insights.`,
          `5. HASHTAGS: Include 3-5 relevant developer hashtags at the end (e.g. #SoftwareEngineering #WebDev #NextJS).`,
          `6. CALL TO ACTION: End with a thought-provoking question to invite comments.`,
          ``,
          `Working Title: ${title}`,
          `Original Article Body:\n${body}`,
          ``,
          `Return ONLY the complete, ready-to-paste LinkedIn post content.`,
        ].join("\n"),
        maxOutputTokens: 2500,
      }),
    { maxRetries: 3 }
  );

  let cleaned = text.trim();
  if (cleaned.length > 2990) {
    cleaned = cleaned.slice(0, 2985) + "\n\n#Tech #SoftwareEngineering";
  }
  return { text: cleaned, model: `groq/${model}` };
}



