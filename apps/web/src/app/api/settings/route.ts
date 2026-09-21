import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { decryptSettingsSecrets, encryptSettingsSecrets } from "@/lib/crypto";
import { SettingsSchema, type Settings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/settings — get user settings (secrets decrypted).
 */
export async function GET(req: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch (e) {
    const reason = e instanceof Error ? e.message.split("\n")[0] : "Invalid ID token";
    return NextResponse.json({ error: `Invalid ID token (${reason})` }, { status: 401 });
  }

  const db = adminDb();
  const snap = await db.doc(`users/${uid}/settings/config`).get();
  if (!snap.exists) {
    return NextResponse.json({ settings: null });
  }

  const raw = snap.data() || {};
  const decrypted = decryptSettingsSecrets(raw);
  const settings = SettingsSchema.parse(decrypted);

  return NextResponse.json({ settings });
}

/**
 * POST /api/settings — save user settings (secrets encrypted with AES-256-GCM).
 */
export async function POST(req: Request) {
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch (e) {
    const reason = e instanceof Error ? e.message.split("\n")[0] : "Invalid ID token";
    return NextResponse.json({ error: `Invalid ID token (${reason})` }, { status: 401 });
  }

  // Rate Limiting
  const rate = checkRateLimit(uid, 10, 60000);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded (10 requests/min). Please try again shortly." },
      { status: 429 }
    );
  }

  const { settings } = (await req.json()) as { settings?: Settings };
  if (!settings) {
    return NextResponse.json({ error: "Missing settings payload" }, { status: 400 });
  }

  const parsed = SettingsSchema.parse(settings);
  const encrypted = encryptSettingsSecrets(parsed as Record<string, unknown>);

  const db = adminDb();
  const now = new Date().toISOString();

  const batch = db.batch();
  batch.set(
    db.doc(`users/${uid}/settings/config`),
    { ...encrypted, updatedAt: now },
    { merge: true }
  );
  batch.set(
    db.doc(`users/${uid}`),
    { uid, updatedAt: now },
    { merge: true }
  );

  await batch.commit();

  return NextResponse.json({ success: true, settings: parsed });
}
