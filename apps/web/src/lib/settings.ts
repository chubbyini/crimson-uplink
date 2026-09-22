import { z } from "zod";

// users/{uid}/settings — BYOK. Keys AES-256-GCM encrypted at rest (see lib/crypto.ts);
// API responses are masked, saves merge so masked values never overwrite real keys.
export const SettingsSchema = z.object({
  geminiKey: z.string().default(""),
  groqKey: z.string().default(""),
  devtoKey: z.string().default(""),
  linkedinToken: z.string().default(""),
  telegramChatId: z.string().default(""),
  githubToken: z.string().default(""),
  jinaKey: z.string().default(""),
  rssFeeds: z.array(z.string()).default([]),
  youtubeChannelIds: z.array(z.string()).default([]),
  blueskyHandles: z.array(z.string()).default([]),
  mastodonHandles: z.array(z.string()).default([]),
  npmPackages: z.array(z.string()).default([]),
  devtoTags: z.array(z.string()).default([]),
  ingestEnabled: z.boolean().default(true),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const emptySettings: Settings = SettingsSchema.parse({});
