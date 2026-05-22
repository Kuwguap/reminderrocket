export const URGENCY_QUOTES = [
  "🚨 Countdown critical",
  "⏳ Clock is moving",
  "⚠️ Final minutes remaining",
  "🔥 Momentum window closing",
  "🚀 Rocket relaunch approaching",
  "⏳ Beat the countdown",
  "🚀 Launch before timer hits zero",
  "⚡ Time is ticking",
  "🔥 Finish before reset",
  "🏁 Race the clock",
  "🚨 Don't let the rocket relaunch",
  "🎯 Complete before next launch",
  "⌛ Final countdown active",
  "🚀 Mission expires soon",
  "⚠️ Momentum window closing",
  "🔥 Push now while energy is high",
  "🎮 Timer challenge activated",
  "🏆 Fast action wins",
  "⚡ Execution mode ON",
  "🚨 Countdown critical",
  "⏳ Zero is approaching",
  "🚀 Finish before next rocket",
  "🎯 Lock in your win now",
  "🛑 Timer almost depleted",
  "🔥 Stay ahead of the clock",
];

export const MOTIVATION_QUOTES = [
  "🏆 Fast action builds confidence",
  "🔥 Momentum creates success",
  "⚡ Discipline beats procrastination",
  "🚀 Push now, relax later",
  "🎯 One completed task changes the day",
  "🔥 Stay productive",
  "🏆 Keep your streak alive",
];

export const REWARD_QUOTES = [
  "🏁 Completion unlocked",
  "🎉 Mission almost complete",
  "🏆 Streak protected",
  "🚀 Productivity boosted",
  "🔥 Victory is one tap away",
];

const ALL_QUOTES = [...URGENCY_QUOTES, ...MOTIVATION_QUOTES, ...REWARD_QUOTES];

/**
 * Pick two distinct quotes from the combined urgency / motivation / reward pools.
 * @returns {[string, string]}
 */
export function pickTwoRandomQuotes() {
  if (ALL_QUOTES.length < 2) {
    return [ALL_QUOTES[0] ?? "", ALL_QUOTES[0] ?? ""];
  }
  const firstIndex = Math.floor(Math.random() * ALL_QUOTES.length);
  let secondIndex = Math.floor(Math.random() * (ALL_QUOTES.length - 1));
  if (secondIndex >= firstIndex) {
    secondIndex += 1;
  }
  return [ALL_QUOTES[firstIndex], ALL_QUOTES[secondIndex]];
}
