import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured, verifyFirebaseToken } from "@/lib/firebase-admin";
import { analyzeUserVoice } from "@/lib/corpus/voice-analyzer";
import { loadSettings } from "@/lib/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/corpus/analyze — run Gemini analysis over corpus items and generate an Agentic Authorial Voice Guide.
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

  const rate = checkRateLimit(uid, 5, 60000);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded (5 voice analyses/min). Please try again shortly." },
      { status: 429 }
    );
  }

  const settings = await loadSettings(adminDb(), uid);
  if (!settings?.geminiKey) {
    return NextResponse.json(
      { error: "Add your Gemini API key in Settings first" },
      { status: 400 }
    );
  }

  const db = adminDb();
  let voiceProfile;
  try {
    voiceProfile = await analyzeUserVoice(db, uid, settings.geminiKey);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Voice analysis failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, voiceProfile });
}
