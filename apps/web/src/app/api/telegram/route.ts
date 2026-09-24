import { NextResponse } from "next/server";
import { isAdminConfigured } from "@/lib/firebase-admin";
import {
  BOT_COMMANDS,
  ensureBotCommands,
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

  // Best-effort: keep the client's command menu + buttons registered.
  // Idempotent per warm instance; failures only log.
  void ensureBotCommands();

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

/**
 * GET /api/telegram?key=<DIAG_SECRET|CRON_SECRET> — diagnostics: is the bot
 * configured, what webhook (if any) Telegram has for it, and the command menu.
 * Answers "is Telegram even delivering updates here?" without leaking secrets.
 */
export async function GET(req: Request) {
  const secret = process.env.DIAG_SECRET || process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "no secret set" }, { status: 503 });
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== secret) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  if (!isTelegramConfigured) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN unset" }, { status: 503 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN as string;
  const tg = async (method: string) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`);
    return (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  };
  const [webhook, commands] = await Promise.all([tg("getWebhookInfo"), tg("getMyCommands")]);
  const info = webhook.result as
    | { url?: string; pending_update_count?: number; last_error_message?: string }
    | undefined;
  return NextResponse.json({
    ok: true,
    webhookSet: Boolean(info?.url),
    webhookUrl: info?.url ?? null,
    pendingUpdates: info?.pending_update_count ?? null,
    lastError: info?.last_error_message ?? null,
    commands,
    menu: BOT_COMMANDS.map((c) => `/${c.command}`),
  });
}
