/**
 * Parse comma / semicolon / newline separated recipient lists.
 *
 * Phone and email columns on `reminders` are stored as a single text value;
 * users can enter one OR many recipients. The cron and UI split that string
 * with the helpers below so each recipient can be addressed individually.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Split a free-form recipient string into trimmed, non-empty chunks.
 * @param {string | null | undefined} input
 * @returns {string[]}
 */
export function splitRecipients(input) {
  if (input == null) return [];
  return String(input)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** @param {string} value */
export function isValidEmail(value) {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}

/** @param {string} value */
export function isValidPhone(value) {
  if (typeof value !== "string") return false;
  const digits = value.replace(/\D/g, "");
  // 8–15 digits per ITU E.164; covers US/CA 10-digit and full international.
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Canonical "a, b, c" string for storage so the column reads cleanly across
 * the active-reminders UI. Returns null for empty input.
 * @param {string | null | undefined} input
 */
export function canonicalizeList(input) {
  const items = splitRecipients(input);
  return items.length === 0 ? null : items.join(", ");
}
