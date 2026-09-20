import { z } from "zod";

export const IdeaFormatSchema = z.enum(["linkedin", "x", "devto"]);

export const IdeaSchema = z.object({
  title: z.string().describe("Working title of the post/article"),
  angle: z
    .string()
    .describe("The specific take — what makes this post worth writing"),
  format: IdeaFormatSchema.describe("Best-fit publish format"),
  sourceUrls: z
    .array(z.string())
    .min(1)
    .describe("URLs from the ingested items backing this idea"),
  score: z.number().min(1).max(10).describe("Timeliness + fit, 10 highest"),
});

export const IdeasSchema = z.object({
  ideas: z.array(IdeaSchema).max(5),
});

export type Idea = z.infer<typeof IdeaSchema>;

export type IdeaStatus = "new" | "approved" | "skipped" | "drafted";

export interface StoredIdea extends Idea {
  status: IdeaStatus;
  createdAt: string;
}
