import { randomUUID } from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import { createClient } from "@supabase/supabase-js";
import {
  formatDateTimeNy,
  parseDatetimeLocalInAppZone,
} from "../lib/nyTime.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
let appBase = process.env.APP_BASE_URL || "";
appBase = appBase.replace(/\/+$/, "");
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const botSecret = process.env.REMINDERROCKET_BOT_SECRET || "";

if (!token || !supabaseUrl || !supabaseAnon || !appBase) {
  console.error(
    "Missing env: TELEGRAM_BOT_TOKEN, APP_BASE_URL, and Supabase URL + anon key."
  );
  process.exit(1);
}
if (!botSecret) {
  console.warn(
    "REMINDERROCKET_BOT_SECRET not set — photo proof uploads will be disabled."
  );
}

const supabaseAuth = createClient(supabaseUrl, supabaseAnon);

/** @type {Map<number, any>} */
const sessions = new Map();

function sess(chatId) {
  let s = sessions.get(chatId);
  if (!s) {
    s = {
      clientId: randomUUID(),
      accessToken: null,
      loginEmail: null,
      loginStep: null,
      pendingEmail: null,
      wizard: null,
      draft: null,
      pendingProofFileId: null,
      pendingProofTargets: null,
      pendingProofTargetId: null,
    };
    sessions.set(chatId, s);
  }
  return s;
}

function foot(chatId) {
  const s = sess(chatId);
  if (s.accessToken && s.loginEmail) {
    return `\n\nLogged in as ${s.loginEmail}`;
  }
  return "\n\nNot synced — use /login to see the same reminders as the website.";
}

async function apiFetch(chatId, path, init = {}) {
  const s = sess(chatId);
  const url = path.startsWith("http") ? path : `${appBase}${path}`;
  /** @type {Record<string, string>} */
  const headers = { ...(init.headers || {}) };
  if (init.body != null && headers["Content-Type"] == null) {
    headers["Content-Type"] = "application/json";
  }
  if (s.accessToken) {
    headers.Authorization = `Bearer ${s.accessToken}`;
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { res, json };
}

/**
 * Fetch active proof-based reminders for a chat via the internal bot endpoint.
 * @param {number} chatId
 * @returns {Promise<Array<{ id: string, message: string }>>}
 */
async function listProofTargetsForChat(chatId) {
  if (!botSecret) return [];
  const url = `${appBase}/api/telegram/proof-targets?telegram_chat_id=${encodeURIComponent(
    String(chatId)
  )}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${botSecret}` },
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return Array.isArray(json?.reminders) ? json.reminders : [];
}

/**
 * Resolve a Telegram file_id to its CDN URL.
 * @param {string} fileId
 * @returns {Promise<string | null>}
 */
async function resolveTelegramFileUrl(fileId) {
  const res = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(
      fileId
    )}`
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.ok || !payload.result?.file_path) {
    return null;
  }
  return `https://api.telegram.org/file/bot${token}/${payload.result.file_path}`;
}

/**
 * Download a Telegram photo and POST it to the proof endpoint as the bot,
 * authenticated via the shared secret + chat_id.
 * @param {number} chatId
 * @param {string} reminderId
 * @param {string} fileId
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function uploadProofFromTelegram(chatId, reminderId, fileId) {
  if (!botSecret) {
    return {
      ok: false,
      error: "Bot secret not configured on the server side.",
    };
  }
  const fileUrl = await resolveTelegramFileUrl(fileId);
  if (!fileUrl) {
    return { ok: false, error: "Could not resolve Telegram file." };
  }
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    return { ok: false, error: `Telegram file download HTTP ${fileRes.status}.` };
  }
  const arrayBuffer = await fileRes.arrayBuffer();
  const contentType = fileRes.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  const filename = `telegram-${Date.now()}.${ext}`;
  const blob = new Blob([arrayBuffer], { type: contentType });

  const form = new FormData();
  form.append("file", blob, filename);

  const url = `${appBase}/api/reminders/${encodeURIComponent(
    reminderId
  )}/proof?telegram_chat_id=${encodeURIComponent(String(chatId))}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${botSecret}` },
    body: form,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    return {
      ok: false,
      error: json?.error || `Upload failed (HTTP ${res.status}).`,
    };
  }
  return { ok: true };
}

const bot = new Bot(token);

bot.command("help", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  await ctx.reply(
    [
      "Reminder Rocket (Telegram)",
      "",
      "/launch — create a reminder (mirrors the website)",
      "/myreminders — list active (use /login first)",
      "/stop <reminder_id> — stop one (id from /myreminders)",
      "/login — send email, then password (same account as the site)",
      "/logout — clear login in this chat",
      "",
      "Send a photo to complete a picture-proof reminder right here.",
      "Telegram-only launches work without signing in.",
      "Sign in to see the same reminders as reminderrocket on the web.",
      "",
      `Web app: ${appBase}`,
    ].join("\n")
  );
  await ctx.reply(foot(id));
});

bot.command("start", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  sess(id);
  await ctx.reply(
    `Reminder Rocket — I ping you until the job is done.\nRun /help for commands.${foot(id)}`
  );
});

bot.command("logout", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  const s = sess(id);
  s.accessToken = null;
  s.loginEmail = null;
  s.loginStep = null;
  s.pendingEmail = null;
  await ctx.reply(`Signed out of this chat.${foot(id)}`);
});

bot.command("login", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  const s = sess(id);
  s.loginStep = "email";
  s.pendingEmail = null;
  await ctx.reply(`Send the email you use on the website.${foot(id)}`);
});

bot.command("launch", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  const s = sess(id);
  s.wizard = "await_message";
  s.draft = {};
  await ctx.reply(
    `What should we remind you to do? Reply with one clear line.${foot(id)}`
  );
});

bot.command("myreminders", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  const s = sess(id);
  if (!s.accessToken) {
    await ctx.reply(
      `Sign in with /login first to load your account reminders.${foot(id)}`
    );
    return;
  }
  const { res, json } = await apiFetch(id, `/api/reminders?status=active`, {
    method: "GET",
  });
  if (!res.ok) {
    await ctx.reply(
      `Could not load reminders (${res.status}).${foot(id)}`
    );
    return;
  }
  const rows = json?.reminders ?? [];
  if (rows.length === 0) {
    await ctx.reply(`No active reminders. Launch one with /launch.${foot(id)}`);
    return;
  }
  const lines = rows.slice(0, 15).map((r, i) => {
    const stop =
      r.stop_condition === "proof"
        ? "proof"
        : r.stop_at
          ? formatDateTimeNy(r.stop_at)
          : "—";
    return `${i + 1}. ${r.message}\n   id: ${r.id}\n   next: ${formatDateTimeNy(r.next_run_at)}\n   stop: ${stop}`;
  });
  await ctx.reply(`${lines.join("\n\n")}\n\nStop with: /stop <id>${foot(id)}`);
});

bot.command("stop", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  const line = ctx.message?.text?.trim() ?? "";
  const reminderId = line.replace(/^\/stop\s+/i, "").trim();
  if (!reminderId || reminderId === "/stop") {
    await ctx.reply(
      `Usage: /stop YOUR_REMINDER_ID\n(Copy the id from /myreminders.)${foot(id)}`
    );
    return;
  }
  const s = sess(id);
  const q = new URLSearchParams();
  q.set("client_id", s.clientId);
  const { res, json } = await apiFetch(
    id,
    `/api/reminders/${encodeURIComponent(reminderId)}/stop?${q.toString()}`,
    { method: "POST" }
  );
  if (!res.ok) {
    await ctx.reply(
      `${json?.error || "Stop failed"} (${res.status})${foot(id)}`
    );
    return;
  }
  await ctx.reply(`Stopped that reminder.${foot(id)}`);
});

bot.on("callback_query:data", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  const data = ctx.callbackQuery.data;
  const s = sess(id);

  const ack = () =>
    ctx.answerCallbackQuery().catch(() => undefined);

  if (data.startsWith("fq:")) {
    const f = data.slice(3);
    if (!s.draft) s.draft = {};
    if (f === "custom") {
      s.wizard = "await_custom_freq";
      await ack();
      await ctx.reply(
        `Send custom interval, e.g. 30 minutes, 2 hours, or 1 days.${foot(id)}`
      );
      return;
    }
    s.draft.frequency_type = f;
    s.draft.frequency_value = null;
    s.draft.frequency_unit = null;
    const kb = new InlineKeyboard()
      .text("Start now", "st:now")
      .text("Schedule…", "st:sched")
      .row();
    s.wizard = "await_start_choice";
    await ack();
    await ctx.reply(`Start time?${foot(id)}`, { reply_markup: kb });
    return;
  }

  if (data.startsWith("st:")) {
    const mode = data.slice(3);
    if (mode === "now") {
      s.draft.startTiming = "now";
      s.draft.scheduledLocal = null;
    } else {
      s.wizard = "await_start_dt";
      await ack();
      await ctx.reply(
        `Send start as YYYY-MM-DDTHH:MM (US Eastern, same as the website).${foot(
          id
        )}`
      );
      return;
    }
    const kb = new InlineKeyboard()
      .text("Stop at a time", "sp:time")
      .text("Require photo proof", "sp:proof")
      .row();
    s.wizard = "await_stop_kind";
    await ack();
    await ctx.reply(`How should this mission end?${foot(id)}`, {
      reply_markup: kb,
    });
    return;
  }

  if (data.startsWith("sp:")) {
    await ack();
    const kind = data.slice(3);
    s.draft.stop_condition = kind;
    if (kind === "proof") {
      s.draft.stopLocal = null;
      await finalizeDraft(ctx, id);
    } else {
      s.wizard = "await_stop_dt";
      await ctx.reply(
        `Send stop time yyyy-MM-ddTHH:mm (Eastern).${foot(id)}`
      );
    }
    return;
  }

  if (data.startsWith("up:")) {
    await ack();
    const reminderId = data.slice(3);
    const fileId = s.pendingProofFileId;
    if (!fileId) {
      await ctx.reply(
        `That photo is no longer pending. Send a new photo to upload.${foot(id)}`
      );
      return;
    }
    s.pendingProofFileId = null;
    s.pendingProofTargets = null;
    await ctx.reply(`Uploading proof…${foot(id)}`);
    const result = await uploadProofFromTelegram(id, reminderId, fileId);
    if (!result.ok) {
      await ctx.reply(
        `Upload failed: ${result.error || "unknown error"}.${foot(id)}`
      );
      return;
    }
    await ctx.reply(`Mission complete. Proof uploaded.${foot(id)}`);
    return;
  }

  if (data.startsWith("pf:")) {
    await ack();
    const reminderId = data.slice(3);
    if (!botSecret) {
      await ctx.reply(
        `Photo proof uploads aren't configured on the server yet.${foot(id)}`
      );
      return;
    }
    s.pendingProofTargetId = reminderId;
    await ctx.reply(
      `📸 Now send the photo to this chat — I'll attach it to that reminder.${foot(
        id
      )}`
    );
    return;
  }
});

/**
 * @param {import("grammy").Context} ctx
 * @param {number} id
 */
async function finalizeDraft(ctx, id) {
  const s = sess(id);
  const d = s.draft;
  const chatId = ctx.chat?.id ?? id;
  const startDate =
    d.startTiming === "now"
      ? new Date()
      : parseDatetimeLocalInAppZone(d.scheduledLocal);
  if (!startDate || Number.isNaN(startDate.getTime())) {
    await ctx.reply(`Invalid start time. Run /launch again.${foot(chatId)}`);
    s.wizard = null;
    s.draft = null;
    return;
  }
  let stopAt = null;
  if (d.stop_condition === "time") {
    const st = parseDatetimeLocalInAppZone(d.stopLocal);
    if (!st || Number.isNaN(st.getTime())) {
      await ctx.reply(`Invalid stop time. Run /launch again.${foot(chatId)}`);
      s.wizard = null;
      s.draft = null;
      return;
    }
    stopAt = st.toISOString();
  }

  const payload = {
    client_id: s.clientId,
    message: d.message,
    recipient_name: "You",
    phone: d.phone || null,
    email: d.email || null,
    frequency_type: d.frequency_type,
    frequency_value: d.frequency_value,
    frequency_unit: d.frequency_unit,
    start_time: startDate.toISOString(),
    stop_condition: d.stop_condition,
    stop_at: stopAt,
    telegram_chat_id: chatId,
  };

  const { res, json } = await apiFetch(chatId, "/api/reminders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  s.wizard = null;
  s.draft = null;

  if (!res.ok) {
    const err =
      json?.errors && Object.values(json.errors).filter(Boolean).join("; ");
    await ctx.reply(
      `${err || json?.error || "Create failed"} (${res.status})${foot(chatId)}`
    );
    return;
  }
  await ctx.reply(
    `Reminder is live. You’ll get Telegram pings in this chat.${foot(chatId)}`
  );
}

/** @param {string} text */
function parseCustomFreq(text) {
  const t = text.trim().toLowerCase();
  const m = t.match(/^(\d+)\s*(minute|minutes|hour|hours|day|days)s?$/);
  if (!m) return null;
  const n = Number(m[1]);
  let unit = m[2].startsWith("minute")
    ? "minutes"
    : m[2].startsWith("hour")
      ? "hours"
      : "days";
  return { value: n, unit };
}

bot.on("message:text", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return;

  const s = sess(id);

  if (s.loginStep === "email") {
    if (!text.includes("@")) {
      await ctx.reply(`Send a valid email.${foot(id)}`);
      return;
    }
    s.pendingEmail = text;
    s.loginStep = "password";
    await ctx.reply(`Send your password.${foot(id)}`);
    return;
  }

  if (s.loginStep === "password") {
    const email = s.pendingEmail;
    const password = text;
    s.loginStep = null;
    s.pendingEmail = null;
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      await ctx.reply(
        `Login failed. Try /login again. (${error?.message || "check credentials"})${foot(id)}`
      );
      return;
    }
    s.accessToken = data.session.access_token;
    s.loginEmail = data.user?.email ?? email;
    await ctx.reply(`Linked. I’ll show your email on every reply.${foot(id)}`);
    return;
  }

  if (s.wizard === "await_message") {
    s.draft.message = text;
    s.wizard = "await_freq";
    const kb = new InlineKeyboard()
      .text("Hourly", "fq:hourly")
      .text("Every 3h", "fq:every-3-hours")
      .row()
      .text("Daily", "fq:daily")
      .text("Annoy mode", "fq:annoy")
      .row()
      .text("Custom…", "fq:custom");
    await ctx.reply(`How often should I ping you?${foot(id)}`, {
      reply_markup: kb,
    });
    return;
  }

  if (s.wizard === "await_custom_freq") {
    const p = parseCustomFreq(text);
    if (!p) {
      await ctx.reply(`Try e.g. 30 minutes or 2 hours.${foot(id)}`);
      return;
    }
    s.draft.frequency_type = "custom";
    s.draft.frequency_value = p.value;
    s.draft.frequency_unit = p.unit;
    s.wizard = "await_start_choice";
    const kb = new InlineKeyboard()
      .text("Start now", "st:now")
      .text("Schedule…", "st:sched")
      .row();
    await ctx.reply(`Start time?${foot(id)}`, { reply_markup: kb });
    return;
  }

  if (s.wizard === "await_start_dt") {
    s.draft.startTiming = "schedule";
    s.draft.scheduledLocal = text;
    const kb = new InlineKeyboard()
      .text("Stop at a time", "sp:time")
      .text("Require photo proof", "sp:proof")
      .row();
    s.wizard = "await_stop_kind";
    await ctx.reply(`How should this mission end?${foot(id)}`, {
      reply_markup: kb,
    });
    return;
  }

  if (s.wizard === "await_stop_dt") {
    s.draft.stopLocal = text;
    s.wizard = null;
    await finalizeDraft(ctx, id);
    return;
  }
});

bot.on("message:photo", async (ctx) => {
  const id = ctx.chat?.id;
  if (id == null) return;
  const photos = ctx.message?.photo ?? [];
  if (photos.length === 0) return;
  const fileId = photos[photos.length - 1].file_id;
  const s = sess(id);

  if (!botSecret) {
    await ctx.reply(
      `Photo proof uploads aren't configured on the server yet. Open the upload link from the reminder for now.${foot(
        id
      )}`
    );
    return;
  }

  // Inline-button flow: user pressed "Upload Photo" first, this is the photo.
  if (s.pendingProofTargetId) {
    const reminderId = s.pendingProofTargetId;
    s.pendingProofTargetId = null;
    s.pendingProofFileId = null;
    s.pendingProofTargets = null;
    await ctx.reply(`Uploading proof…${foot(id)}`);
    const result = await uploadProofFromTelegram(id, reminderId, fileId);
    if (!result.ok) {
      await ctx.reply(
        `Upload failed: ${result.error || "unknown error"}.${foot(id)}`
      );
      return;
    }
    await ctx.reply(`Mission complete. Proof uploaded.${foot(id)}`);
    return;
  }

  const targets = await listProofTargetsForChat(id);
  if (targets.length === 0) {
    await ctx.reply(
      `No active picture-proof reminders to complete in this chat. Launch one or wait for the next reminder.${foot(
        id
      )}`
    );
    return;
  }

  if (targets.length === 1) {
    const target = targets[0];
    await ctx.reply(`Uploading proof for: ${target.message}…${foot(id)}`);
    const result = await uploadProofFromTelegram(id, target.id, fileId);
    if (!result.ok) {
      await ctx.reply(
        `Upload failed: ${result.error || "unknown error"}.${foot(id)}`
      );
      return;
    }
    await ctx.reply(`Mission complete. Proof uploaded.${foot(id)}`);
    return;
  }

  s.pendingProofFileId = fileId;
  s.pendingProofTargets = targets.map((t) => t.id);
  const kb = new InlineKeyboard();
  for (const t of targets.slice(0, 8)) {
    const label = (t.message || "Reminder").slice(0, 48);
    kb.text(label, `up:${t.id}`).row();
  }
  await ctx.reply(`Which mission does this proof complete?${foot(id)}`, {
    reply_markup: kb,
  });
});

bot.catch((err) => {
  console.error("Bot error:", err);
});

await bot.start({
  onStart: (info) => console.log(`Reminder Rocket Telegram bot @${info.username}`),
});
