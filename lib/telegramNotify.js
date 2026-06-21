/**
 * Escape a string for safe inclusion in a Telegram HTML message.
 * Only `<`, `>`, and `&` need to be entity-escaped per Telegram's HTML mode.
 * @param {string} value
 * @returns {string}
 */
export function escapeTelegramHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send a DM via Telegram Bot API. Supports inline keyboards and HTML formatting.
 * @param {string} botToken
 * @param {number|string} chatId
 * @param {string} text
 * @param {{ replyMarkup?: object, parseMode?: "HTML" | "MarkdownV2" }} [options]
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  if (!botToken || chatId == null) {
    return { ok: false, error: "Missing bot token or chat id." };
  }
  try {
    const body = {
      chat_id: chatId,
      text: text.slice(0, 4090),
      disable_web_page_preview: true,
    };
    if (options.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }
    if (options.parseMode) {
      body.parse_mode = options.parseMode;
    }
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      return {
        ok: false,
        error:
          payload?.description ||
          `Telegram HTTP ${response.status}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function sendTelegramMedia(
  botToken,
  chatId,
  method,
  mediaField,
  mediaUrl,
  options = {}
) {
  if (!botToken || chatId == null) {
    return { ok: false, error: "Missing bot token or chat id." };
  }
  try {
    const body = {
      chat_id: chatId,
      [mediaField]: mediaUrl,
    };
    if (options.caption) {
      body.caption = String(options.caption).slice(0, 1024);
    }
    if (options.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }
    if (options.parseMode) {
      body.parse_mode = options.parseMode;
    }
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      return {
        ok: false,
        error:
          payload?.description ||
          `Telegram HTTP ${response.status}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * @param {string} botToken
 * @param {number|string} chatId
 * @param {string} photoUrl Public or signed URL Telegram can fetch
 * @param {{ caption?: string, replyMarkup?: object, parseMode?: string }} [options]
 */
export async function sendTelegramPhoto(botToken, chatId, photoUrl, options = {}) {
  return sendTelegramMedia(botToken, chatId, "sendPhoto", "photo", photoUrl, options);
}

/**
 * @param {string} botToken
 * @param {number|string} chatId
 * @param {string} audioUrl Public or signed URL Telegram can fetch
 * @param {{ caption?: string, replyMarkup?: object, parseMode?: string }} [options]
 */
export async function sendTelegramAudio(botToken, chatId, audioUrl, options = {}) {
  return sendTelegramMedia(botToken, chatId, "sendAudio", "audio", audioUrl, options);
}
