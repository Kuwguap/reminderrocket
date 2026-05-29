/**
 * Constant-time-ish comparison guarded by a length check.
 * Avoids early returns that could leak length differences.
 */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Returns true when the request carries `Authorization: Bearer <REMINDERROCKET_BOT_SECRET>`
 * and the env var is set. Use this to authenticate the long-running Telegram bot
 * service when it acts on behalf of a user identified by chat_id.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function hasValidBotSecret(request) {
  const expected = process.env.REMINDERROCKET_BOT_SECRET;
  if (!expected) {
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }
  return safeEqual(match[1].trim(), expected);
}
