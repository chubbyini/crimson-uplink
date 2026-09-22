import { Bot, InputFile } from "grammy";
import { chunkText, markdownToPlain } from "./plaintext";

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

/**
 * Send a long plain-text body chunked into Telegram-safe messages.
 * Plain (no parse_mode) so it copy-pastes cleanly and never breaks on
 * markdown/HTML entities in the draft.
 */
async function sendFullText(
  b: Bot,
  chatId: string | number,
  header: string,
  body: string
) {
  const chunks = chunkText(body);
  if (!chunks.length) {
    await b.api.sendMessage(String(chatId), header);
    return;
  }
  const total = chunks.length;
  for (let i = 0; i < total; i++) {
    const prefix = total > 1 ? `${header}\n(part ${i + 1}/${total})\n\n` : `${header}\n\n`;
    await b.api.sendMessage(String(chatId), `${prefix}${chunks[i]}`);
  }
}

/** Send a copy-ready .txt file so the user can open/copy in one tap. */
async function sendCopyFile(
  b: Bot,
  chatId: string | number,
  filename: string,
  text: string,
  caption: string
) {
  const file = new InputFile(Buffer.from(text, "utf8"), filename);
  await b.api.sendDocument(String(chatId), file, { caption });
}

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
  for (const idea of ideas) {
    const probe = `ia:${uid}:${idea.id}`;
    if (probe.length > 64) {
      throw new Error(`Telegram callback_data exceeds 64 bytes for idea ${idea.id} (uid too long)`);
    }
  }

  const lines = ideas.map((idea, n) => {
    const link = idea.sourceUrls[0] ?? "";
    return (
      `<b>${n + 1}. ${esc(trunc(idea.title, 120))}</b>\n` +
      `${esc(idea.format)} · ${idea.score}/10\n` +
      `${esc(trunc(idea.angle, 160))}\n` +
      (link ? `${esc(link)}` : "")
    );
  });

  await b.api.sendMessage(chatId, `<b>Crimson Uplink — top ${ideas.length}</b>\n\n${lines.join("\n\n")}`, {
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

/** Render and send the FULL article draft (plain wording) + control card with Publish/Edit/Reject/Copy buttons. */
export async function sendDraftCard(
  chatId: string | number,
  uid: string,
  draftId: string,
  draft: { title: string; body: string; format?: string; model?: string; linkedinBody?: string },
  note?: string
) {
  const b = getBot();
  if (!b) return;

  const plain = markdownToPlain(draft.body);
  const wordCount = plain.split(/\s+/).filter(Boolean).length;
  const hasLi = Boolean(draft.linkedinBody);
  const title = draft.title.trim() || "(untitled)";

  if (note) {
    await b.api.sendMessage(String(chatId), note, { parse_mode: "HTML" });
  }

  // 1. Full copy-friendly article text (normal wording, no markdown).
  await sendFullText(
    b,
    chatId,
    `📝 FULL ARTICLE DRAFT — ${title} (${wordCount} words)`,
    `${title}\n\n${plain}`
  );

  // 2. Control card with approval + copy actions.
  const text =
    `📝 <b>Review: ${esc(trunc(title, 80))}</b>\n` +
    `<i>${wordCount} words · ${esc(draft.model || "Groq")}${hasLi ? " · 💼 LinkedIn post ready" : ""}</i>\n\n` +
    `Full text is above ☝️ — read it, then approve, edit, or grab the copy-ready version:`;

  await b.api.sendMessage(String(chatId), text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💼 Review LinkedIn Post", callback_data: `dl:${uid}:${draftId}` },
          { text: "📰 Publish to Dev.to", callback_data: `dd:${uid}:${draftId}` },
        ],
        [
          { text: "✏️ Edit Article with AI", callback_data: `de:${uid}:${draftId}` },
          { text: "❌ Reject", callback_data: `dr:${uid}:${draftId}` },
        ],
        [
          { text: "📋 Copy-ready text", callback_data: `ca:${uid}:${draftId}` },
        ],
      ],
    },
  });
}

/** Render and send the FULL LinkedIn post (plain wording) + Approve & Post / Edit / Copy buttons. */
export async function sendLinkedinCard(
  chatId: string | number,
  uid: string,
  draftId: string,
  title: string,
  linkedinBody: string,
  note?: string
) {
  const b = getBot();
  if (!b) return;

  const full = linkedinBody.trim();
  const charCount = full.length;
  const cleanTitle = title.trim() || "(untitled)";

  if (note) {
    await b.api.sendMessage(String(chatId), note, { parse_mode: "HTML" });
  }

  // 1. Full copy-friendly LinkedIn text (already plain wording).
  await sendFullText(
    b,
    chatId,
    `💼 FULL LINKEDIN POST — ${cleanTitle} (${charCount} / 3,000 characters)`,
    full
  );

  // 2. Control card with approval + copy actions.
  const text =
    `💼 <b>LinkedIn review: ${esc(trunc(cleanTitle, 80))}</b>\n` +
    `<i>Length: ${charCount} / 3,000 characters</i>\n\n` +
    `Full post is above ☝️ — read it, then approve & post, refine, or grab the copy-ready version:\n\n` +
    `⚠️ <b>Approval Required:</b> Tap <b>Approve & Post</b> below to publish live to LinkedIn.`;

  await b.api.sendMessage(String(chatId), text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🚀 Approve & Post to LinkedIn", callback_data: `lp:${uid}:${draftId}` },
        ],
        [
          { text: "✏️ Refine LinkedIn with AI", callback_data: `le:${uid}:${draftId}` },
          { text: "🔙 View Full Article", callback_data: `da:${uid}:${draftId}` },
        ],
        [
          { text: "📋 Copy LinkedIn text", callback_data: `cl:${uid}:${draftId}` },
        ],
      ],
    },
  });
}

/**
 * Handle Telegram callbacks:
 * - ia: Idea Approve -> marks approved, generates draft article + refined LinkedIn post, replies with draft card
 * - is: Idea Skip -> marks skipped
 * - dl: Draft LinkedIn -> shows LinkedIn review card for user approval
 * - lp: LinkedIn Post -> user approves LinkedIn post, publishes to LinkedIn API
 * - le: LinkedIn Edit -> sets active editing target to "linkedin" for user DM prompt
 * - dd: Dev.to Publish -> publishes draft article directly to Dev.to API
 * - dp: Draft Publish All -> publishes Dev.to, then prompts user to review & approve LinkedIn post
 * - de: Draft Edit -> sets active editing target to "article" for user DM prompt
 * - da: Draft Article -> switches view back to full article card
 * - dr: Draft Reject -> marks draft rejected
 * - ca: Copy Article -> sends the full plain-wording article + .txt file for easy copy-paste
 * - cl: Copy LinkedIn -> sends the full LinkedIn post + .txt file for easy copy-paste
 */
export async function handleCallback(
  callbackId: string,
  fromChatId: number,
  data: string
): Promise<string> {
  const b = getBot();
  if (!b) throw new Error("Telegram not configured");

  const m = data.match(/^([a-z]{2}):([^:]+):([^:]+)$/);
  if (!m) {
    await b.api.answerCallbackQuery(callbackId, { text: "Unknown action" });
    return "unknown";
  }
  const [, actionCode, uid, targetId] = m;
  const isIdea = actionCode === "ia" || actionCode === "is";
  const { assertDocId } = await import("./validation");
  let safeId: string;
  try {
    safeId = assertDocId(targetId, isIdea ? "ideaId" : "draftId");
  } catch {
    await b.api.answerCallbackQuery(callbackId, { text: "Invalid reference" });
    return "invalid";
  }

  const { adminDb } = await import("./firebase-admin");
  const db = adminDb();

  // Verify sender owns these settings (shared-bot safety)
  const settingsSnap = await db.doc(`users/${uid}/settings/config`).get();
  const chatId = settingsSnap.data()?.telegramChatId as string | undefined;
  if (!chatId || String(fromChatId) !== String(chatId).trim()) {
    await b.api.answerCallbackQuery(callbackId, { text: "Not your account" });
    return "forbidden";
  }

  // --- 1. IDEA ACTIONS ---
  if (actionCode === "is") {
    try {
      await db.doc(`users/${uid}/ideas/${safeId}`).update({ status: "skipped" });
    } catch {
      await b.api.answerCallbackQuery(callbackId, { text: "Idea no longer exists" });
      return "gone";
    }
    await b.api.answerCallbackQuery(callbackId, { text: "Skipped" });
    return "skipped";
  }

  if (actionCode === "ia") {
    await b.api.answerCallbackQuery(callbackId, { text: "Approved ✓ Drafting..." });
    try {
      await db.doc(`users/${uid}/ideas/${safeId}`).update({ status: "approved" });
    } catch {
      return "gone";
    }

    const { loadSettings } = await import("./pipeline");
    const settings = await loadSettings(db, uid);
    if (!settings?.groqKey) {
      await b.api.sendMessage(
        String(fromChatId),
        "⚠️ <b>Idea approved!</b> Add your Groq API key in Crimson Uplink → Settings to enable auto-drafting in Telegram.",
        { parse_mode: "HTML" }
      );
      return "approved-no-groq";
    }

    const ideaSnap = await db.doc(`users/${uid}/ideas/${safeId}`).get();
    if (!ideaSnap.exists) return "gone";
    const idea = ideaSnap.data() as {
      title: string;
      angle: string;
      format?: "linkedin" | "x" | "devto";
      sourceUrls?: string[];
    };

    const progressMsg = await b.api.sendMessage(
      String(fromChatId),
      `⏳ <i>Drafting article + refining for LinkedIn with Groq:</i>\n<b>${esc(trunc(idea.title, 80))}</b>…`,
      { parse_mode: "HTML" }
    );

    try {
      const { generateDraft, refineForLinkedin } = await import("./draft/generate");
      const draftRes = await generateDraft(settings.groqKey, {
        title: idea.title,
        angle: idea.angle,
        format: idea.format || "devto",
        sourceUrls: idea.sourceUrls || [],
      });

      let linkedinBody = "";
      try {
        const liRes = await refineForLinkedin(settings.groqKey, idea.title, draftRes.text);
        linkedinBody = liRes.text;
      } catch (err) {
        console.warn("LinkedIn refine during draft creation failed:", err);
      }

      const now = new Date().toISOString();
      const draftRef = db.collection(`users/${uid}/drafts`).doc();
      await draftRef.set({
        ideaId: safeId,
        title: idea.title,
        format: idea.format || "devto",
        body: draftRes.text,
        model: draftRes.model,
        ...(linkedinBody ? { linkedinBody, linkedinCharCount: linkedinBody.length } : {}),
        status: "pending_review",
        createdAt: now,
        updatedAt: now,
      });
      await db.doc(`users/${uid}/ideas/${safeId}`).update({ status: "drafted" });

      try {
        await b.api.deleteMessage(fromChatId, progressMsg.message_id);
      } catch {}

      await sendDraftCard(fromChatId, uid, draftRef.id, {
        title: idea.title,
        body: draftRes.text,
        format: idea.format,
        model: draftRes.model,
        linkedinBody,
      });
      return "drafted";
    } catch (e) {
      try {
        await b.api.deleteMessage(fromChatId, progressMsg.message_id);
      } catch {}
      const errMsg = e instanceof Error ? e.message : "Draft generation failed";
      await b.api.sendMessage(
        String(fromChatId),
        `❌ <b>Drafting failed:</b> ${esc(errMsg)}`,
        { parse_mode: "HTML" }
      );
      return "draft-failed";
    }
  }

  // --- 2. DRAFT ACTIONS ---
  if (actionCode === "dr") {
    try {
      await db.doc(`users/${uid}/drafts/${safeId}`).update({
        status: "rejected",
        updatedAt: new Date().toISOString(),
      });
    } catch {
      await b.api.answerCallbackQuery(callbackId, { text: "Draft no longer exists" });
      return "gone";
    }
    await b.api.answerCallbackQuery(callbackId, { text: "Draft rejected" });
    await b.api.sendMessage(String(fromChatId), "❌ <b>Draft marked as rejected.</b>", { parse_mode: "HTML" });
    return "rejected";
  }

  if (actionCode === "da") {
    await b.api.answerCallbackQuery(callbackId, { text: "Viewing article" });
    const draftSnap = await db.doc(`users/${uid}/drafts/${safeId}`).get();
    if (!draftSnap.exists) return "gone";
    const draft = draftSnap.data() as {
      title: string;
      body: string;
      format?: string;
      model?: string;
      linkedinBody?: string;
    };
    await sendDraftCard(fromChatId, uid, safeId, draft);
    return "view-article";
  }

  if (actionCode === "ca") {
    await b.api.answerCallbackQuery(callbackId, { text: "Sending copy-ready text…" });
    const draftSnap = await db.doc(`users/${uid}/drafts/${safeId}`).get();
    if (!draftSnap.exists) {
      await b.api.sendMessage(String(fromChatId), "Draft not found.", { parse_mode: "HTML" });
      return "gone";
    }
    const draft = draftSnap.data() as { title: string; body: string };
    const plain = markdownToPlain(draft.body);
    const full = `${(draft.title || "").trim()}\n\n${plain}`.trim();
    await sendFullText(b, fromChatId, "📋 COPY-READY ARTICLE (plain wording — long-press to copy)", full);
    try {
      await sendCopyFile(b, fromChatId, `article-${safeId}.txt`, full, "📋 Same article as a .txt file — open & copy in one tap.");
    } catch (e) {
      console.warn("send article copy file failed:", e);
    }
    return "copy-article";
  }

  if (actionCode === "cl") {
    await b.api.answerCallbackQuery(callbackId, { text: "Sending copy-ready LinkedIn text…" });
    const draftSnap = await db.doc(`users/${uid}/drafts/${safeId}`).get();
    if (!draftSnap.exists) {
      await b.api.sendMessage(String(fromChatId), "Draft not found.", { parse_mode: "HTML" });
      return "gone";
    }
    const draft = draftSnap.data() as { title: string; body: string; linkedinBody?: string };
    const full = (draft.linkedinBody || markdownToPlain(draft.body)).trim();
    await sendFullText(b, fromChatId, "📋 COPY-READY LINKEDIN POST (plain wording — long-press to copy)", full);
    try {
      await sendCopyFile(b, fromChatId, `linkedin-${safeId}.txt`, full, "📋 Same LinkedIn post as a .txt file — open & copy in one tap.");
    } catch (e) {
      console.warn("send linkedin copy file failed:", e);
    }
    return "copy-linkedin";
  }

  if (actionCode === "dl") {
    await b.api.answerCallbackQuery(callbackId, { text: "Loading full LinkedIn post" });
    const draftSnap = await db.doc(`users/${uid}/drafts/${safeId}`).get();
    if (!draftSnap.exists) {
      await b.api.sendMessage(String(fromChatId), "Draft not found.", { parse_mode: "HTML" });
      return "gone";
    }
    const draft = draftSnap.data() as {
      title: string;
      body: string;
      linkedinBody?: string;
    };

    let liBody = draft.linkedinBody;
    if (!liBody) {
      const { loadSettings } = await import("./pipeline");
      const settings = await loadSettings(db, uid);
      if (settings?.groqKey) {
        const prog = await b.api.sendMessage(String(fromChatId), "⏳ <i>Refining for LinkedIn with Groq…</i>", { parse_mode: "HTML" });
        try {
          const { refineForLinkedin } = await import("./draft/generate");
          const refined = await refineForLinkedin(settings.groqKey, draft.title, draft.body);
          liBody = refined.text;
          await db.doc(`users/${uid}/drafts/${safeId}`).update({
            linkedinBody: liBody,
            linkedinCharCount: liBody.length,
          });
        } finally {
          try { await b.api.deleteMessage(fromChatId, prog.message_id); } catch {}
        }
      } else {
        liBody = draft.body.slice(0, 2900);
      }
    }

    await sendLinkedinCard(fromChatId, uid, safeId, draft.title, liBody || draft.body);
    return "view-linkedin";
  }

  if (actionCode === "de") {
    await b.api.answerCallbackQuery(callbackId, { text: "Send article instructions" });
    await db.doc(`users/${uid}/settings/state`).set(
      { activeEditDraftId: safeId, editTarget: "article", updatedAt: new Date().toISOString() },
      { merge: true }
    );
    await b.api.sendMessage(
      String(fromChatId),
      "✏️ <b>Send instructions to edit the Article with AI:</b>\n\n" +
        "<i>Examples:</i>\n" +
        "• <i>\"Make it punchier and cut the intro.\"</i>\n" +
        "• <i>\"Add code snippets for database connection pooling.\"</i>\n" +
        "• <i>\"Focus more on latency and system trade-offs.\"</i>\n\n" +
        "Send your prompt below (or <code>/cancel</code>):",
      { parse_mode: "HTML" }
    );
    return "awaiting-edit-article";
  }

  if (actionCode === "le") {
    await b.api.answerCallbackQuery(callbackId, { text: "Send LinkedIn instructions" });
    await db.doc(`users/${uid}/settings/state`).set(
      { activeEditDraftId: safeId, editTarget: "linkedin", updatedAt: new Date().toISOString() },
      { merge: true }
    );
    await b.api.sendMessage(
      String(fromChatId),
      "✏️ <b>Send instructions to refine the LinkedIn post:</b>\n\n" +
        "<i>Examples:</i>\n" +
        "• <i>\"Create a more contrarian single-line hook on sentence 1.\"</i>\n" +
        "• <i>\"Add clean bullet points with ⚡ and add #WebDev #TypeScript.\"</i>\n" +
        "• <i>\"Shorten to under 1,800 characters for mobile readers.\"</i>\n\n" +
        "Send your prompt below (or <code>/cancel</code>):",
      { parse_mode: "HTML" }
    );
    return "awaiting-edit-linkedin";
  }

  if (actionCode === "lp") {
    await b.api.answerCallbackQuery(callbackId, { text: "Publishing to LinkedIn..." });
    const draftSnap = await db.doc(`users/${uid}/drafts/${safeId}`).get();
    if (!draftSnap.exists) {
      await b.api.sendMessage(String(fromChatId), "Draft not found.", { parse_mode: "HTML" });
      return "gone";
    }
    const draft = draftSnap.data() as {
      title: string;
      body: string;
      linkedinBody?: string;
    };

    const { loadSettings } = await import("./pipeline");
    const settings = await loadSettings(db, uid);
    if (!settings?.linkedinToken) {
      await b.api.sendMessage(
        String(fromChatId),
        "⚠️ <b>LinkedIn token not configured.</b>\nAdd your LinkedIn token in Crimson Uplink → Settings first.",
        { parse_mode: "HTML" }
      );
      return "no-linkedin-token";
    }

    const progressMsg = await b.api.sendMessage(
      String(fromChatId),
      `⏳ <i>Posting to LinkedIn…</i>`,
      { parse_mode: "HTML" }
    );

    const postText = draft.linkedinBody || draft.body;
    try {
      const { publishToLinkedin } = await import("./publish/linkedin");
      const liRes = await publishToLinkedin(settings.linkedinToken, postText);
      await db.collection(`users/${uid}/publishes`).add({
        draftId: safeId,
        title: draft.title,
        platform: "linkedin",
        url: liRes.url,
        postUrn: liRes.postUrn,
        publishedAt: new Date().toISOString(),
      });
      await db.doc(`users/${uid}/drafts/${safeId}`).update({
        linkedinPublishedAt: new Date().toISOString(),
        status: "published",
        updatedAt: new Date().toISOString(),
      });

      try { await b.api.deleteMessage(fromChatId, progressMsg.message_id); } catch {}

      await b.api.sendMessage(
        String(fromChatId),
        `🎉 <b>Posted to LinkedIn!</b>\n\n🔗 <a href="${esc(liRes.url)}">${esc(liRes.url)}</a>`,
        { parse_mode: "HTML", link_preview_options: { is_disabled: false } }
      );
      return "linkedin-published";
    } catch (e) {
      try { await b.api.deleteMessage(fromChatId, progressMsg.message_id); } catch {}
      const errMsg = e instanceof Error ? e.message : "LinkedIn publish failed";
      await b.api.sendMessage(
        String(fromChatId),
        `❌ <b>LinkedIn publish failed:</b> ${esc(errMsg)}`,
        { parse_mode: "HTML" }
      );
      return "linkedin-failed";
    }
  }

  if (actionCode === "dd") {
    await b.api.answerCallbackQuery(callbackId, { text: "Publishing to Dev.to..." });
    const draftSnap = await db.doc(`users/${uid}/drafts/${safeId}`).get();
    if (!draftSnap.exists) {
      await b.api.sendMessage(String(fromChatId), "Draft not found.", { parse_mode: "HTML" });
      return "gone";
    }
    const draft = draftSnap.data() as { title: string; body: string };

    const { loadSettings } = await import("./pipeline");
    const settings = await loadSettings(db, uid);
    if (!settings?.devtoKey) {
      await b.api.sendMessage(
        String(fromChatId),
        "⚠️ <b>Dev.to API key not configured.</b>\nAdd your Dev.to key in Settings first.",
        { parse_mode: "HTML" }
      );
      return "no-devto-key";
    }

    const progressMsg = await b.api.sendMessage(
      String(fromChatId),
      `⏳ <i>Publishing to Dev.to…</i>`,
      { parse_mode: "HTML" }
    );

    try {
      const { publishToDevto } = await import("./publish/devto");
      const devtoRes = await publishToDevto(settings.devtoKey, {
        title: draft.title,
        bodyMarkdown: draft.body,
        published: true,
      });
      await db.collection(`users/${uid}/publishes`).add({
        draftId: safeId,
        title: draft.title,
        platform: "devto",
        url: devtoRes.url,
        devtoId: devtoRes.id,
        publishedAt: new Date().toISOString(),
      });
      await db.doc(`users/${uid}/drafts/${safeId}`).update({
        devtoPublishedAt: new Date().toISOString(),
        status: "published",
        updatedAt: new Date().toISOString(),
      });

      try { await b.api.deleteMessage(fromChatId, progressMsg.message_id); } catch {}

      await b.api.sendMessage(
        String(fromChatId),
        `🎉 <b>Published to Dev.to!</b>\n\n🔗 <a href="${esc(devtoRes.url)}">${esc(devtoRes.url)}</a>`,
        { parse_mode: "HTML", link_preview_options: { is_disabled: false } }
      );
      return "devto-published";
    } catch (e) {
      try { await b.api.deleteMessage(fromChatId, progressMsg.message_id); } catch {}
      const errMsg = e instanceof Error ? e.message : "Dev.to publish failed";
      await b.api.sendMessage(
        String(fromChatId),
        `❌ <b>Dev.to publish failed:</b> ${esc(errMsg)}`,
        { parse_mode: "HTML" }
      );
      return "devto-failed";
    }
  }

  if (actionCode === "dp") {
    await b.api.answerCallbackQuery(callbackId, { text: "Processing publish..." });
    const draftSnap = await db.doc(`users/${uid}/drafts/${safeId}`).get();
    if (!draftSnap.exists) {
      await b.api.sendMessage(String(fromChatId), "Draft not found.", { parse_mode: "HTML" });
      return "gone";
    }
    const draft = draftSnap.data() as {
      title: string;
      body: string;
      linkedinBody?: string;
    };

    const { loadSettings } = await import("./pipeline");
    const settings = await loadSettings(db, uid);
    let devtoUrl: string | null = null;

    if (settings?.devtoKey) {
      const devMsg = await b.api.sendMessage(String(fromChatId), "⏳ <i>Publishing to Dev.to…</i>", { parse_mode: "HTML" });
      try {
        const { publishToDevto } = await import("./publish/devto");
        const res = await publishToDevto(settings.devtoKey, {
          title: draft.title,
          bodyMarkdown: draft.body,
          published: true,
        });
        await db.collection(`users/${uid}/publishes`).add({
          draftId: safeId,
          title: draft.title,
          platform: "devto",
          url: res.url,
          devtoId: res.id,
          publishedAt: new Date().toISOString(),
        });
        devtoUrl = res.url;
      } catch (e) {
        console.error("Devto auto-publish failed:", e);
      } finally {
        try { await b.api.deleteMessage(fromChatId, devMsg.message_id); } catch {}
      }
    }

    // Next: Bring up LinkedIn post for MANDATORY approval before posting
    let liBody = draft.linkedinBody;
    if (!liBody && settings?.groqKey) {
      const { refineForLinkedin } = await import("./draft/generate");
      try {
        const ref = await refineForLinkedin(settings.groqKey, draft.title, draft.body);
        liBody = ref.text;
        await db.doc(`users/${uid}/drafts/${safeId}`).update({
          linkedinBody: liBody,
          linkedinCharCount: liBody.length,
        });
      } catch {}
    }

    const note = devtoUrl
      ? `✅ <b>Published to Dev.to:</b> <a href="${esc(devtoUrl)}">${esc(devtoUrl)}</a>\n\nNow, review your refined LinkedIn post before posting:`
      : `Review your refined LinkedIn post before posting:`;

    await sendLinkedinCard(fromChatId, uid, safeId, draft.title, liBody || draft.body, note);
    return "devto-and-review-linkedin";
  }

  return "unhandled";
}

const HELP =
  "<b>Crimson Uplink Bot</b>\n\n" +
  "• <code>/topics ai, rust, GPUs</code> — research topics & score ideas.\n" +
  "• <code>/ingest</code> — fresh full run: pull sources, score ideas, send digest.\n" +
  "• Morning digests arrive daily at 06:00 UTC.\n" +
  "• Tap <b>✅</b> on an idea to auto-draft article + LinkedIn post.\n" +
  "• Full draft text (plain wording, no markdown) arrives in Telegram so you can read & approve.\n" +
  "• Tap <b>💼 Review LinkedIn Post</b> to approve or refine before posting.\n" +
  "• Tap <b>📰 Publish to Dev.to</b> to publish live directly.\n" +
  "• Tap <b>📋 Copy-ready text</b> to get a plain-wording version + .txt file for easy copy-paste.\n" +
  "• Type <code>/cancel</code> anytime to abort an active edit session.";

/**
 * Handle incoming DMs:
 * 1. If user is in an active draft edit session, treat message as AI prompt (article or LinkedIn).
 * 2. /topics runs the full research -> ideas -> digest flow.
 * 3. /ingest runs a fresh full run: ingest -> score ideas -> digest.
 * 4. /cancel clears active edit state.
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

  // Handle /cancel
  if (text.trim().toLowerCase() === "/cancel") {
    await db.doc(`users/${uid}/settings/state`).set({ activeEditDraftId: null, editTarget: null }, { merge: true });
    await send("Edit session cancelled.");
    return "cancelled";
  }

  // Check if user is in an active edit session for a draft
  const stateSnap = await db.doc(`users/${uid}/settings/state`).get();
  const activeDraftId = stateSnap.data()?.activeEditDraftId as string | undefined;
  const editTarget = stateSnap.data()?.editTarget as string | undefined;

  if (activeDraftId && !text.trim().startsWith("/")) {
    const draftSnap = await db.doc(`users/${uid}/drafts/${activeDraftId}`).get();
    if (draftSnap.exists) {
      const draft = draftSnap.data() as {
        title: string;
        body: string;
        format?: string;
        model?: string;
        linkedinBody?: string;
      };
      const { loadSettings } = await import("./pipeline");
      const settings = await loadSettings(db, uid);

      if (!settings?.groqKey) {
        await send("⚠️ Add your Groq API key in Settings to use AI editing.", false);
        return "no-groq-key";
      }

      // Clear edit state
      await db.doc(`users/${uid}/settings/state`).set({ activeEditDraftId: null, editTarget: null }, { merge: true });

      // Branch 1: Editing LinkedIn Refined Post
      if (editTarget === "linkedin") {
        const prog = await b.api.sendMessage(
          String(chatId),
          `⏳ <i>Refining LinkedIn post with Groq:</i>\n"${esc(trunc(text, 100))}"…`,
          { parse_mode: "HTML" }
        );

        try {
          const { generateText } = await import("ai");
          const { createGroq } = await import("@ai-sdk/groq");
          const groq = createGroq({ apiKey: settings.groqKey });
          const modelName = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

          const currentContent = draft.linkedinBody || draft.body;
          const { text: refinedText } = await generateText({
            model: groq(modelName),
            system: "You are an elite LinkedIn tech influencer and ghostwriter.",
            prompt: [
              `Refine the following LinkedIn post according strictly to the user's instructions.`,
              `STRICT CONSTRAINTS:`,
              `1. The total text MUST be STRICTLY UNDER 3000 CHARACTERS.`,
              `2. High engagement: strong opening hook, double-spaced paragraphs, bullet points, CTA question, 3-5 developer hashtags.`,
              ``,
              `--- CURRENT LINKEDIN POST ---`,
              currentContent,
              ``,
              `--- USER INSTRUCTIONS ---`,
              text,
              ``,
              `Return ONLY the complete updated LinkedIn post.`,
            ].join("\n"),
            maxOutputTokens: 2500,
          });

          let cleaned = refinedText.trim();
          if (cleaned.length > 2990) {
            cleaned = cleaned.slice(0, 2985) + "…\n\n#Tech #WebDev";
          }

          const now = new Date().toISOString();
          await db.doc(`users/${uid}/drafts/${activeDraftId}`).update({
            linkedinBody: cleaned,
            linkedinCharCount: cleaned.length,
            editedAt: now,
            updatedAt: now,
          });

          try { await b.api.deleteMessage(chatId, prog.message_id); } catch {}

          await sendLinkedinCard(
            chatId,
            uid,
            activeDraftId,
            draft.title,
            cleaned,
            "✨ <b>LinkedIn post updated with your instructions!</b>"
          );
          return "linkedin-edited";
        } catch (e) {
          try { await b.api.deleteMessage(chatId, prog.message_id); } catch {}
          await send(`❌ <b>LinkedIn editing failed:</b> ${esc(e instanceof Error ? e.message : "unknown")}`);
          return "edit-failed";
        }
      }

      // Branch 2: Editing Full Article Draft
      const prog = await b.api.sendMessage(
        String(chatId),
        `⏳ <i>Refining article draft with Groq:</i>\n"${esc(trunc(text, 100))}"…`,
        { parse_mode: "HTML" }
      );

      try {
        const { editDraftWithGroq, refineForLinkedin } = await import("./draft/generate");
        const edited = await editDraftWithGroq(settings.groqKey, draft.body, text);
        
        let newLiBody = draft.linkedinBody;
        try {
          const liRef = await refineForLinkedin(settings.groqKey, draft.title, edited.text);
          newLiBody = liRef.text;
        } catch {}

        const now = new Date().toISOString();
        await db.doc(`users/${uid}/drafts/${activeDraftId}`).update({
          body: edited.text,
          model: edited.model,
          ...(newLiBody ? { linkedinBody: newLiBody, linkedinCharCount: newLiBody.length } : {}),
          editedAt: now,
          updatedAt: now,
        });

        try { await b.api.deleteMessage(chatId, prog.message_id); } catch {}

        await sendDraftCard(
          chatId,
          uid,
          activeDraftId,
          {
            title: draft.title,
            body: edited.text,
            format: draft.format,
            model: edited.model,
            linkedinBody: newLiBody,
          },
          "✨ <b>Article draft updated with your instructions!</b>"
        );
        return "draft-edited";
      } catch (e) {
        try { await b.api.deleteMessage(chatId, prog.message_id); } catch {}
        await send(`❌ <b>Editing failed:</b> ${esc(e instanceof Error ? e.message : "unknown")}`);
        return "edit-failed";
      }
    }
  }

  // Handle /ingest (fresh full run) or /topics or general commands
  const lower = text.trim().toLowerCase();
  if (lower.startsWith("/ingest")) {
    const { checkRateLimit } = await import("./rate-limit");
    const rate = checkRateLimit(`tg-ingest:${chatId}`, 1, 5 * 60 * 1000);
    if (!rate.success) {
      await send("⏳ <b>/ingest</b> runs max once every 5 minutes — please wait a bit.", true);
      return "rate-limited";
    }

    const { ingestForUser, loadSettings, scoreForUser } = await import("./pipeline");
    const settings = await loadSettings(db, uid);
    if (!settings) {
      await send("Save your Settings in Crimson Uplink first.", false);
      return "no-settings";
    }

    await send("🔄 <b>Running a fresh ingest…</b> pulling sources, may take up to a minute.", true);
    try {
      const ingest = await ingestForUser(db, uid, settings);
      await send(
        `📥 <b>Ingest done:</b> ${ingest.fetched} fetched · ${ingest.added} new · ${ingest.seenBefore} seen before. Scoring ideas with Gemini…`,
        true
      );
    } catch (e) {
      await send(
        `Ingest failed: ${esc(e instanceof Error ? e.message.split("\n")[0] : "unknown")}`,
        false
      );
      return "ingest-failed";
    }

    try {
      const topics = [...(settings.devtoTags ?? []), ...(settings.npmPackages ?? [])].slice(0, 8);
      const scored = await scoreForUser(db, uid, settings, topics.length ? topics : undefined);
      if (!scored.telegram.sent && scored.telegram.reason) {
        await send(`💡 Scored <b>${scored.count} ideas</b>, but digest send failed: ${esc(scored.telegram.reason)}`, true);
        return "ingest-scored-no-digest";
      }
      return "ingested";
    } catch (e) {
      await send(
        `Scoring failed: ${esc(e instanceof Error ? e.message.split("\n")[0] : "unknown")}`,
        false
      );
      return "score-failed";
    }
  }

  if (!lower.startsWith("/topics")) {
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
      })),
      topics
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
