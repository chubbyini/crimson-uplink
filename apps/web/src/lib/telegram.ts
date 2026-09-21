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

  await b.api.sendMessage(chatId, `<b>Crimson Uplink — top 10</b>\n\n${lines.join("\n\n")}`, {
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

/** Handle Approve/Skip taps. Returns a short status for logging. */export async function handleCallback(
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

const HELP =
  "Send <code>/topics ai, vector databases</code> and I'll research them " +
  "across HN, GitHub, Lobsters, Stack Overflow, Dev.to and Medium, then " +
  "reply with 10 scored ideas (approve with ✅). " +
  "Morning digests arrive automatically at 06:00.";

/**
 * Handle incoming DMs. /topics runs the full research → ideas → digest flow
 * for the user whose Settings chat ID matches; anything else gets HELP.
 * Note: runs synchronously inside the webhook — allow up to ~60s.
 */
export async function handleIncomingMessage(
  chatId: number,
  text: string
): Promise<string> {
  const b = getBot();
  if (!b) throw new Error("Telegram not configured");

  const { adminDb } = await import("./firebase-admin");
  const db = adminDb();

  const send = (msg: string, parse = true) =>
    b.api.sendMessage(String(chatId), msg, {
      ...(parse ? { parse_mode: "HTML" as const } : {}),
    });

  if (!text.trim().toLowerCase().startsWith("/topics")) {
    await send(HELP);
    return "help";
  }

  // Per-chat /topics rate limiting (max 1 request per 30 seconds)
  const { checkRateLimit } = await import("./rate-limit");
  const rate = checkRateLimit(`tg:${chatId}`, 1, 30000);
  if (!rate.success) {
    await send("⏳ Please wait 30 seconds between <b>/topics</b> research queries.", true);
    return "rate-limited";
  }

  // Which user owns this chat? (shared-bot safety)
  const owners = await db
    .collectionGroup("settings")
    .where("telegramChatId", "==", String(chatId))
    .limit(1)
    .get();
  if (owners.empty) {
    await send(
      "I don't know this chat. Save your Telegram chat ID in Crimson Uplink → Settings first.",
      false
    );
    return "unknown-chat";
  }
  const uid = owners.docs[0].ref.parent.parent!.id;

  const topics = text
    .replace(/^\/topics(@\w+)?/i, "")
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!topics.length) {
    await send("Give me topics: <code>/topics ai, rust, GPUs</code>");
    return "no-topics";
  }

  const { SettingsSchema } = await import("./settings");
  const { searchTopics } = await import("./search");
  const { scoreIdeas } = await import("./ideas/score");
  const { storeItems } = await import("./pipeline");

  const settingsSnap = await db.doc(`users/${uid}/settings/config`).get();
  const settings = SettingsSchema.parse(settingsSnap.data());
  if (!settings.geminiKey) {
    await send("Add your Gemini API key in Settings first.", false);
    return "no-key";
  }

  await send(`Researching <b>${esc(topics.join(", "))}</b>… give me up to a minute.`);
  const now = new Date().toISOString();
  try {
    const raw = await searchTopics({
      topics,
      githubToken: settings.githubToken || undefined,
    });
    await storeItems(db, uid, raw, { topicSearch: topics });
    const ideas = await scoreIdeas(
      settings.geminiKey,
      [...new Map(raw.map((i) => [i.url, i])).values()].map((i) => ({
        title: i.title,
        url: i.url,
        source: i.source,
        points: i.points,
        commentCount: i.commentCount,
      }))
    );

    const batch = db.batch();
    const ids = ideas.map((idea) => {
      const ref = db.collection(`users/${uid}/ideas`).doc();
      batch.set(ref, { ...idea, status: "new", createdAt: now, topicSearch: topics });
      return ref.id;
    });
    await batch.commit();

    await sendDigest(
      String(chatId),
      uid,
      ideas.map((idea, n) => ({ ...idea, id: ids[n] }))
    );
    return "digested";
  } catch (e) {
    await send(
      `Research failed: ${esc(e instanceof Error ? e.message.split("\n")[0] : "unknown")}`,
      false
    );
    return "failed";
  }
}
