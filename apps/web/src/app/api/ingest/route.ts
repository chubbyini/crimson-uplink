import { NextResponse } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { runIngest } from "@/lib/ingest";
import { urlHash } from "@/lib/ingest/normalize";
import { SettingsSchema } from "@/lib/settings";

/**
 * POST /api/ingest — run the morning pull on demand for the signed-in user.
 * Auth: Firebase ID token in `Authorization: Bearer <token>`.
 * Writes deduped docs to users/{uid}/items/{urlHash}.
 */
export async function POST(req: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Server not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON to env (see apps/web/.env.example).",
      },
      { status: 503 }
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }

  const db = adminDb();
  const settingsSnap = await db.doc(`users/${uid}/settings/config`).get();
  if (!settingsSnap.exists) {
    return NextResponse.json({ error: "Save Settings first" }, { status: 400 });
  }
  const settings = SettingsSchema.parse(settingsSnap.data());

  const raw = await runIngest(settings);
  const now = new Date().toISOString();

  // Dedupe: skip hashes already stored for this user.
  const refs = new Map<string, (typeof raw)[number]>();
  for (const item of raw) {
    try {
      refs.set(urlHash(item.url), item);
    } catch {
      // Unparseable URL — skip.
    }
  }
  const snaps = refs.size ? await db.getAll(...[...refs.keys()].map((h) => db.doc(`users/${uid}/items/${h}`))) : [];
  const existing = new Set(snaps.filter((s) => s.exists).map((s) => s.id));

  const batch = db.batch();
  let added = 0;
  for (const [hash, item] of refs) {
    if (existing.has(hash)) {
      batch.set(
        db.doc(`users/${uid}/items/${hash}`),
        { lastSeenAt: now },
        { merge: true }
      );
    } else {
      batch.set(db.doc(`users/${uid}/items/${hash}`), {
        ...item,
        hash,
        firstSeenAt: now,
        lastSeenAt: now,
      });
      added += 1;
    }
  }
  if (refs.size) await batch.commit();

  return NextResponse.json({
    fetched: raw.length,
    unique: refs.size,
    added,
    seenBefore: refs.size - added,
  });
}
