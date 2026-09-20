import { Bot } from "grammy";

export interface DigestIdea {
  id: string;
  title: string;
  angle: string;
  format: string;
  score: number;
  sourceUrls: string[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const trunc = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

let bot: Bot | null | undefined;

export const isTelegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);

function getBot(): Bot | null {
  if (bot !== undefined) return bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  bot = token ? new Bot(token) : null;
  return bot;
}

/** Top-5 digest with per-idea Approve/Skip buttons. Callback data is <64 bytes. */
export async function sendDigest(
  chatId: string,
  uid: string,
  ideas: DigestIdea[]
) {
  const b = getBot();
  if (!b) throw new Error("Telegram not configured (TELEGRAM_BOT_TOKEN)");

  const lines = ideas.map((idea, n) => {
    const link = idea.sourceUrls[0] ?? "";
    return (
      `<b>${n + 1}. ${esc(trunc(idea.title, 120))}</b>\n` +
      `${esc(idea.format)} · ${idea.score}/10\n` +
      `${esc(trunc(idea.angle, 160))}\n` +
      (link ? `${esc(link)}` : "")
    );
  });

  await b.api.sendMessage(chatId, `<b>Crimson Uplink — top 5</b>\n\n${lines.join("\n\n")}`, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: ideas.map((idea) => [
        {
          text: `✅ ${trunc(idea.title, 24)}`,
          callback_data: `ia:${uid}:${idea.id}`,
        },
        {
          text: "⏭ Skip",
          callback_data: `is:${uid}:${idea.id}`,
        },
      ]),
    },
  });
}

/** Handle Approve/Skip taps. Returns a short status for logging. */
export async function handleCallback(
  callbackId: string,
  fromChatId: number,
  data: string
): Promise<string> {
  const b = getBot();
  if (!b) throw new Error("Telegram not configured");

  const m = data.match(/^i([as]):([^:]+):([^:]+)$/);
  if (!m) {
    await b.api.answerCallbackQuery(callbackId, { text: "Unknown action" });
    return "unknown";
  }
  const [, action, uid, ideaId] = m;

  // Dynamic import keeps firebase-admin out of edge-cold paths; lazy is fine.
  const { adminDb } = await import("./firebase-admin");
  const db = adminDb();

  // Verify the tapper owns these settings (shared-bot safety).
  const settingsSnap = await db.doc(`users/${uid}/settings/config`).get();
  const chatId = settingsSnap.data()?.telegramChatId as string | undefined;
  if (!chatId || String(fromChatId) !== String(chatId).trim()) {
    await b.api.answerCallbackQuery(callbackId, { text: "Not your digest" });
    return "forbidden";
  }

  await db.doc(`users/${uid}/ideas/${ideaId}`).update({
    status: action === "a" ? "approved" : "skipped",
  });
  await b.api.answerCallbackQuery(callbackId, {
    text: action === "a" ? "Approved ✓" : "Skipped",
  });
  return action === "a" ? "approved" : "skipped";
}
