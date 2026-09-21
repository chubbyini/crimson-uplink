import type { Firestore } from "firebase-admin/firestore";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { VoiceProfileSchema, type VoiceProfile, type CorpusItem } from "./types";
import { withExponentialBackoff } from "@/lib/ai/retry";

/**
 * Gemini = Brains: analyze the user's past writing corpus and construct a dynamic Agentic Authorial Voice Guide.
 */
export async function analyzeUserVoice(
  db: Firestore,
  uid: string,
  geminiKey: string
): Promise<VoiceProfile> {
  if (!geminiKey) throw new Error("Gemini API key is required to analyze voice profile");

  const snap = await db.collection(`users/${uid}/corpus`).limit(20).get();
  const items = snap.docs.map((d) => d.data() as CorpusItem);

  if (!items.length) {
    throw new Error("No writing samples found in your corpus. Import Dev.to, GitHub, or paste custom articles first.");
  }

  const sampleSummaries = items.map(
    (item, index) =>
      `--- SAMPLE ${index + 1}: ${item.title} (${item.source}) ---\n` +
      item.body.slice(0, 2500)
  );

  const google = createGoogleGenerativeAI({ apiKey: geminiKey });

  const { object } = await withExponentialBackoff(
    async () =>
      generateObject({
        model: google("gemini-3.5-flash-lite"),
        schema: VoiceProfileSchema,
        system:
          "You are a master developer ghostwriter, linguistic analyst, and content strategist. " +
          "Analyze the user's provided writing samples deeply. " +
          "Extract their distinct authorial voice, sentence cadence, technical vocabulary, code snippet style, opening hook techniques, and paragraph structure. " +
          "Synthesize a clear, actionable AGENTIC STYLE GUIDE PROMPT that can be injected directly into future AI generation tasks so AI ghostwriters write exactly like this author. " +
          "Also identify 5 concrete content gaps and follow-up article opportunities missing from or extending their existing body of work.",
        prompt: `Writing Samples from Author's Corpus:\n\n${sampleSummaries.join("\n\n")}`,
      }),
    { maxRetries: 3 }
  );

  const now = new Date().toISOString();
  const profile: VoiceProfile = {
    ...object,
    lastAnalyzedAt: now,
    sampleCount: items.length,
  };

  // Save the voice profile to users/{uid}/voice/profile
  await db.doc(`users/${uid}/voice/profile`).set(profile);

  return profile;
}

/**
 * Load the active Agentic Authorial Voice Guide for a user, falling back to static defaults if not analyzed yet.
 */
export async function loadVoiceProfile(
  db: Firestore,
  uid: string
): Promise<string> {
  try {
    const snap = await db.doc(`users/${uid}/voice/profile`).get();
    if (snap.exists) {
      const data = snap.data() as VoiceProfile;
      if (data.styleGuidePrompt) {
        return (
          `AGENTIC AUTHORIAL VOICE GUIDE (Learned from user's ${data.sampleCount} writing samples):\n` +
          `TONE: ${data.toneSummary}\n` +
          `CADENCE: ${data.sentenceCadence}\n` +
          `VOCABULARY & DEPTH: ${data.vocabularyStyle}\n` +
          `HOOK STYLE: ${data.hookStyle}\n` +
          `CODE STYLE: ${data.codeFormattingStyle}\n\n` +
          `SPECIFIC AUTHOR INSTRUCTIONS:\n${data.styleGuidePrompt}`
        );
      }
    }
  } catch (e) {
    console.warn("Failed to load custom voice profile:", e);
  }

  return "Write clearly, concretely, and directly for developers.";
}
