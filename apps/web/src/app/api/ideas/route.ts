import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { scoreIdeas } from "@/lib/ideas/score";
import { SettingsSchema } from "@/lib/settings";

/**
 * POST /api/ideas — score the user's freshest items into a top-5 idea bank.
 * Auth: Firebase ID token in `Authorization: Bearer <token>`.
 * Reads users/{uid}/items (latest 40), writes users/{uid}/ideas.
 */
export async function POST(req: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json(
      { error: "Server not configured (FIREBASE_SERVICE_ACCOUNT_JSON)." },
      { status: 503 }
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch (e) {
    const reason =
      e instanceof Error ? e.message.split("\n")[0] : "Invalid ID token";
    return NextResponse.json(
      { error: `Invalid ID token (${reason}). Try signing out/in; if it persists, sync your system clock.` },
      { status: 401 }
    );
  }

  const db = adminDb();
  const settingsSnap = await db.doc(`users/${uid}/settings/config`).get();
  if (!settingsSnap.exists) {
    return NextResponse.json({ error: "Save Settings first" }, { status: 400 });
  }
  const settings = SettingsSchema.parse(settingsSnap.data());
  if (!settings.geminiKey) {
    return NextResponse.json(
      { error: "Add your Gemini API key in Settings first" },
      { status: 400 }
    );
  }

  const itemsSnap = await db
    .collection(`users/${uid}/items`)
    .orderBy("lastSeenAt", "desc")
    .limit(40)
    .get();
  const items = itemsSnap.docs.map((d) => {
    const v = d.data() as { title?: string; url?: string; source?: string; points?: number; commentCount?: number };
    return {
      title: v.title ?? "(untitled)",
      url: v.url ?? "",
      source: v.source ?? "rss",
      points: v.points,
      commentCount: v.commentCount,
    };
  }).filter((i) => i.url);

  if (!items.length) {
    return NextResponse.json(
      { error: "No items yet — run ingest first" },
      { status: 400 }
    );
  }

  let ideas;
  try {
    ideas = await scoreIdeas(settings.geminiKey, items);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Gemini failed: ${e.message}` : "Gemini failed" },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  const refs = ideas.map((idea) => {
    const ref = db.collection(`users/${uid}/ideas`).doc();
    batch.set(ref, { ...idea, status: "new", createdAt: now });
    return ref.id;
  });
  await batch.commit();

  // Best-effort Telegram digest — scoring already succeeded, never fail it.
  let telegram: { sent: boolean; reason?: string } = { sent: false };
  if (settings.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const { sendDigest } = await import("@/lib/telegram");
      await sendDigest(
        settings.telegramChatId.trim(),
        uid,
        ideas.map((idea, n) => ({ ...idea, id: refs[n] }))
      );
      telegram = { sent: true };
    } catch (e) {
      telegram = {
        sent: false,
        reason: e instanceof Error ? e.message.split("\n")[0] : "send failed",
      };
    }
  } else {
    telegram = { sent: false, reason: "Telegram not configured" };
  }

  return NextResponse.json({ count: ideas.length, ids: refs, ideas, telegram });
}
