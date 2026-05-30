/**
 * Phrases the cron prepends to "annoy me until done" SMS messages so each
 * ping reads slightly differently. Uses modular rotation keyed by the number
 * of attempts already sent (deterministic, not random — feels like a thread).
 */
export const SMS_ANNOY_PHRASES = [
  "Hey, did you do it?",
  "Push push push 🚀",
  "Still waiting on you ⏳",
  "Time to act.",
  "You got this — just do it.",
  "Don't ignore me 👀",
  "5 minutes is all it takes.",
  "Tiny step now → big win later.",
  "You're ignoring this.",
  "Make it happen now.",
  "🔥 Momentum window closing.",
  "Last call before next ping.",
  "🏁 Race the clock — let's go.",
  "🚨 Countdown is on.",
  "Last warning.",
];

/**
 * @param {number} attemptCount Zero-based number of annoy SMS already sent.
 * @returns {string}
 */
export function getAnnoyPhrase(attemptCount) {
  const list = SMS_ANNOY_PHRASES;
  const index =
    Number.isFinite(attemptCount) && attemptCount >= 0
      ? Math.floor(attemptCount) % list.length
      : 0;
  return list[index] ?? list[0];
}
