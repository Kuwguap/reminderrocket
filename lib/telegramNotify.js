/**
 * Send a plain-text DM via Telegram Bot API.
 * @param {string} botToken
 * @param {number|string} chatId
 * @param {string} text
 * @param {{ replyMarkup?: object }} [options]
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
