import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { IdeasSchema } from "./schema";

export interface ScorableItem {
  title: string;
  url: string;
  source: string;
  points?: number;
  commentCount?: number;
  /** Article excerpt — when present, angles must reflect what the piece argues. */
  excerpt?: string;
  excerptVia?: "jina" | "self";
  excerptAt?: string;
}

const PROMPT_EXCERPT_CHARS = 1500;

/**
 * Synthesize rich article ideas directly from topics when external web items are scarce.
 */
export async function generateIdeasFromTopics(apiKey: string, topics: string[]) {
  const google = createGoogleGenerativeAI({ apiKey });
  const { object } = await generateObject({
    model: google("gemini-3.5-flash-lite"),
    schema: IdeasSchema,
    system:
      "You are a master technical content strategist for software engineers. " +
      "The user provided specific topic(s). Synthesize 5 rich, in-depth, publication-worthy article ideas directly from deep domain knowledge of these topics. " +
      "Each idea must have a catchy title, a concrete opinionated angle (never a generic summary), an appropriate format ('devto' for deep technical articles, 'linkedin' for industry takes, 'x' for newsy updates), a high score (8-10), and relevant reference documentation topic URLs.",
    prompt: `Target Topics:\n${topics.map((t) => `- ${t}`).join("\n")}`,
  });
  return object.ideas;
}

/**
 * Gemini = brains: turn a pile of fresh items (or topic list) into scored article ideas.
 * Caller passes the USER's key (BYOK) — never a shared server key.
 */
export async function scoreIdeas(
  apiKey: string,
  items: ScorableItem[],
  topics?: string[]
) {
  if (items.length < 3 && topics && topics.length > 0) {
    return generateIdeasFromTopics(apiKey, topics);
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const lines = items.map((i, n) => {
    const head =
      `${n + 1}. [${i.source}] ${i.title} (${i.url})` +
      (i.points != null ? ` — ${i.points} points` : "");
    const excerpt = i.excerpt?.trim();
    return excerpt ? `${head}\n   Excerpt: ${excerpt.slice(0, PROMPT_EXCERPT_CHARS)}` : head;
  });

  const { object } = await generateObject({
    model: google("gemini-3.5-flash-lite"),
    schema: IdeasSchema,
    system:
      "You curate content ideas for a developer who posts on LinkedIn, X, and Dev.to. " +
      "Pick the 10 items with the best mix of timeliness, substance, and fit for a practitioner's audience. " +
      "Each idea needs a concrete angle — never a generic summary. " +
      "When an excerpt is provided, the angle MUST reflect what the piece actually argues — its claims, evidence, and stance — never the headline alone. " +
      "Suggested format: linkedin for opinionated takes, x for newsy/one-chart items, devto for deep technical topics.",
    prompt: `Fresh items:\n${lines.join("\n")}`,
  });

  if ((!object.ideas || object.ideas.length < 3) && topics && topics.length > 0) {
    const topicIdeas = await generateIdeasFromTopics(apiKey, topics);
    return [...(object.ideas || []), ...topicIdeas].slice(0, 10);
  }

  return object.ideas;
}

