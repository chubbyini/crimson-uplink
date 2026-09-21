import { NextResponse } from "next/server";
import { isAdminConfigured } from "@/lib/firebase-admin";
import {
  handleCallback,
  handleIncomingMessage,
  isTelegramConfigured,
} from "@/lib/telegram";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/telegram — Telegram webhook: digest button taps (callback_query)
 * and DMs (/topics research, /start help).
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
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Set TELEGRAM_WEBHOOK_SECRET in server env." },
      { status: 503 }
    );
  }
  {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expected) return NextResponse.json({ ok: false }, { status: 403 });
  }

  const update = (await req.json()) as {
    callback_query?: { id: string; from?: { id?: number }; data?: string };
    message?: { chat?: { id?: number }; text?: string };
  };
  const cb = update.callback_query;
  if (cb?.id && cb.data && cb.from?.id) {
    try {
      await handleCallback(cb.id, cb.from.id, cb.data);
    } catch (e) {
      // Log for `vercel logs` / server console; Telegram already got its answer
      // inside handleCallback for known paths.
      console.error("telegram callback failed:", e instanceof Error ? e.message : e);
    }
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  if (msg?.chat?.id && typeof msg.text === "string") {
    try {
      await handleIncomingMessage(msg.chat.id, msg.text);
    } catch (e) {
      console.error("telegram message failed:", e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ ok: true });
}
