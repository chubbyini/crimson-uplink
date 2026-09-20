import { NextResponse } from "next/server";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { handleCallback, isTelegramConfigured } from "@/lib/telegram";

/**
 * POST /api/telegram — Telegram webhook (callback_query from digest buttons).
 * Set once per deploy:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PUBLIC_URL>/api/telegram&secret_token=<SECRET>
 * with TELEGRAM_WEBHOOK_SECRET in server env. Local dev can't receive
 * webhooks (no public URL) — dashboard Approve/Skip covers local use.
 */
export async function POST(req: Request) {
  if (!isAdminConfigured || !isTelegramConfigured) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expected) return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await req.json()) as {
    callback_query?: { id: string; from?: { id?: number }; data?: string };
  };
  const cb = update.callback_query;
  if (!cb?.id || !cb.data || !cb.from?.id) {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleCallback(cb.id, cb.from.id, cb.data);
  } catch (e) {
    // Log for `vercel logs` / server console; Telegram already got its answer
    // inside handleCallback for known paths.
    console.error("telegram callback failed:", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
