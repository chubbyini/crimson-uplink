import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import {
  decryptSettingsSecrets,
  encryptSettingsSecrets,
  isMaskedSecret,
  maskSettingsSecrets,
} from "@/lib/crypto";
import { SettingsSchema, type Settings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECRET_FIELDS = ["geminiKey", "groqKey", "devtoKey", "linkedinToken", "githubToken", "jinaKey"] as const;

/**
 * GET /api/settings — get user settings (secret API keys are MASKED in the response).
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
  const parsed = SettingsSchema.parse(decrypted);

  // Mask secrets so plain API keys are NEVER exposed in client API responses
  const masked = maskSettingsSecrets(parsed as Record<string, unknown>);

  return NextResponse.json({ settings: masked });
}

/**
 * POST /api/settings — save user settings (encrypts secrets with AES-256-GCM, masks response).
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

  const db = adminDb();
  const snap = await db.doc(`users/${uid}/settings/config`).get();
  const existingRaw = snap.exists ? snap.data() || {} : {};
  const existingDecrypted = decryptSettingsSecrets(existingRaw) as Record<string, unknown>;

  // Merge incoming secret keys: preserve existing decrypted keys if incoming is masked or empty
  const incoming = { ...settings } as Record<string, unknown>;
  for (const field of SECRET_FIELDS) {
    const val = incoming[field];
    if (typeof val === "string" && (isMaskedSecret(val) || val.trim() === "")) {
      if (existingDecrypted[field] && typeof existingDecrypted[field] === "string") {
        incoming[field] = existingDecrypted[field];
      }
    }
  }

  const parsed = SettingsSchema.parse(incoming);
  const encrypted = encryptSettingsSecrets(parsed as Record<string, unknown>);

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

  // Return response with secret fields masked
  const maskedResponse = maskSettingsSecrets(parsed as Record<string, unknown>);

  return NextResponse.json({ success: true, settings: maskedResponse });
}
