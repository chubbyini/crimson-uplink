import { z } from "zod";

export interface CorpusItem {
  id: string;
  title: string;
  source: "devto" | "github" | "custom";
  body: string;
  url?: string;
  wordCount: number;
  createdAt: string;
}

export const ContentGapSchema = z.object({
  topic: z.string().describe("Topic or subject area not fully covered in user's corpus"),
  angle: z.string().describe("Specific proposed article take or angle"),
  format: z.enum(["linkedin", "x", "devto"]).describe("Recommended format"),
  rationale: z.string().describe("Why this gap/follow-up is valuable based on past posts"),
});

export const VoiceProfileSchema = z.object({
  toneSummary: z.string().describe("Brief 1-2 sentence summary of authorial tone"),
  sentenceCadence: z.string().describe("Pacing, paragraph length, and rhythm guidelines"),
  vocabularyStyle: z.string().describe("Technical depth, jargon use, and key phrasing patterns"),
  codeFormattingStyle: z.string().describe("How code snippets and technical examples should be formatted"),
  hookStyle: z.string().describe("How opening lines and article hooks are constructed"),
  styleGuidePrompt: z
    .string()
    .describe("Complete, detailed system prompt instructions for AI ghostwriters to write in this exact authorial voice"),
  gapsAndFollowups: z.array(ContentGapSchema).max(6).describe("Identified content gaps and follow-up article ideas"),
});

export type VoiceProfile = z.infer<typeof VoiceProfileSchema> & {
  lastAnalyzedAt: string;
  sampleCount: number;
};
