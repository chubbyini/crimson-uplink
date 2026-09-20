import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { IdeasSchema } from "./schema";

export interface ScorableItem {
  title: string;
  url: string;
  source: string;
  points?: number;
  commentCount?: number;
}

/**
 * Gemini = brains: turn a pile of fresh items into 5 scored ideas.
 * Caller passes the USER's key (BYOK) — never a shared server key.
 */
export async function scoreIdeas(apiKey: string, items: ScorableItem[]) {
  const google = createGoogleGenerativeAI({ apiKey });
  const lines = items.map(
    (i, n) =>
      `${n + 1}. [${i.source}] ${i.title} (${i.url})` +
      (i.points != null ? ` — ${i.points} points` : "")
  );

  const { object } = await generateObject({
    model: google("gemini-2.0-flash-lite"),
    schema: IdeasSchema,
    system:
      "You curate content ideas for a developer who posts on LinkedIn, X, and Dev.to. " +
      "Pick the 5 items with the best mix of timeliness, substance, and fit for a practitioner's audience. " +
      "Each idea needs a concrete angle — never a generic summary. " +
      "Suggested format: linkedin for opinionated takes, x for newsy/one-chart items, devto for deep technical topics.",
    prompt: `Fresh items:\n${lines.join("\n")}`,
  });
  return object.ideas;
}
