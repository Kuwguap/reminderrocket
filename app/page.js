"use client";

import { useEffect, useState } from "react";

const quotes = [
  "Mission focus beats motivation every time.",
  "Small launches lead to big orbits.",
  "Set it once, stay accountable.",
  "Momentum starts with the first reminder.",
];

const frequencyOptions = [
  {
    id: "hourly",
    label: "Every hour",
    detail: "Best for short, urgent tasks.",
  },
  {
    id: "every-3-hours",
    label: "Every 3 hours",
    detail: "Steady check-ins across the day.",
  },
  {
    id: "daily",
    label: "Daily",
    detail: "A single prompt each day.",
  },
  {
    id: "custom",
    label: "Custom",
    detail: "Pick your own interval.",
  },
];

export default function Home() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [recipientMode, setRecipientMode] = useState("me");
  const [frequency, setFrequency] = useState("hourly");
  const [startTiming, setStartTiming] = useState("now");
  const [specialRecipientName, setSpecialRecipientName] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((current) => (current + 1) % quotes.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const primaryButtonClass =
    "cursor-pointer rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";
  const primaryButtonSmallClass =
    "cursor-pointer rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-white transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";
  const segmentedButtonClass =
    "cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";
  const isForMe = recipientMode === "me";
  const recipientName = isForMe ? "You" : specialRecipientName;

  return (
    <main className="min-h-screen bg-primary">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-secondary px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
            Reminder Rocket
          </p>
          <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
            Start now, stay on track.
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            Launch reminders the moment you need them, keep them persistent, and
            end only when the mission is complete.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={primaryButtonClass}
            >
              Start now
            </button>
            <button
              type="button"
              className={primaryButtonClass}
            >
              Schedule for later
            </button>
          </div>
        </header>

        <section className="mt-12 grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-3xl border border-secondary/20 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                Create a reminder
              </h2>
              <span className="rounded-full border border-secondary px-3 py-1 text-xs font-semibold text-secondary">
                Start now
              </span>
            </div>

            <form className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Reminder message
                <textarea
                  rows={4}
                  placeholder="Remind me to..."
                  className="w-full resize-none rounded-2xl border border-secondary/20 px-4 py-3 text-sm text-slate-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </label>
              <div className="grid gap-3 rounded-2xl border border-secondary/20 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Who are we reminding?
                  </p>
                  <div className="flex items-center gap-2 rounded-full border border-secondary/20 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setRecipientMode("me")}
                      aria-pressed={isForMe}
                      className={`${segmentedButtonClass} ${
                        isForMe
                          ? "border-secondary bg-secondary text-white"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      For me
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientMode("someone")}
                      aria-pressed={!isForMe}
                      className={`${segmentedButtonClass} ${
                        !isForMe
                          ? "border-secondary bg-secondary text-white"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Someone special
                    </button>
                  </div>
                </div>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Recipient name
                  <input
                    type="text"
                    placeholder={isForMe ? "You" : "Someone special"}
                    className="w-full rounded-2xl border border-secondary/20 px-4 py-3 text-sm text-slate-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
                    disabled={isForMe}
                    value={recipientName}
                    onChange={(event) => setSpecialRecipientName(event.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Phone
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    className="w-full rounded-2xl border border-secondary/20 px-4 py-3 text-sm text-slate-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Email
                  <input
                    type="email"
                    placeholder="rocket@launch.com"
                    className="w-full rounded-2xl border border-secondary/20 px-4 py-3 text-sm text-slate-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </label>
              </div>

              <div className="grid gap-3 text-sm font-medium text-slate-700">
                Frequency
                <div className="grid gap-3 sm:grid-cols-2">
                  {frequencyOptions.map((option) => {
                    const isActive = frequency === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setFrequency(option.id)}
                        aria-pressed={isActive}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                          isActive
                            ? "border-secondary bg-secondary/10 text-secondary"
                            : "border-secondary/20 text-slate-700 hover:border-secondary/40"
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {option.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {frequency === "custom" && (
                  <div className="grid gap-3 sm:grid-cols-[1fr,140px]">
                    <input
                      type="number"
                      min={5}
                      step={5}
                      placeholder="30"
                      className="w-full rounded-2xl border border-secondary/20 px-4 py-3 text-sm text-slate-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
                    />
                    <select className="w-full rounded-2xl border border-secondary/20 px-4 py-3 text-sm text-slate-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary">
                      <option>Minutes</option>
                      <option>Hours</option>
                      <option>Days</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid gap-2 text-sm font-medium text-slate-700">
                Start time
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStartTiming("now")}
                    className={`${primaryButtonSmallClass} ${
                      startTiming === "now" ? "" : "opacity-70"
                    }`}
                  >
                    Start now
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartTiming("schedule")}
                    className={`${primaryButtonSmallClass} ${
                      startTiming === "schedule" ? "" : "opacity-70"
                    }`}
                  >
                    Schedule
                  </button>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Stop condition
                <select className="w-full rounded-2xl border border-secondary/20 px-4 py-3 text-sm text-slate-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary">
                  <option>End at a specific time</option>
                  <option>Require picture proof</option>
                </select>
              </label>

              <button
                type="submit"
                className={`mt-2 ${primaryButtonClass}`}
              >
                Launch reminder
              </button>
            </form>
          </div>

          <aside className="rounded-3xl border border-secondary/20 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              What stays in orbit
            </h3>
            <div className="mt-4 rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                Mission control
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                "{quotes[quoteIndex]}"
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Rotating quotes update every few seconds.
              </p>
            </div>
            <ul className="mt-6 grid gap-4 text-sm text-slate-600">
              <li className="rounded-2xl border border-secondary/30 px-4 py-3">
                Dual-channel delivery via SMS and email.
              </li>
              <li className="rounded-2xl border border-secondary/30 px-4 py-3">
                Flexible recipients for yourself or someone special.
              </li>
              <li className="rounded-2xl border border-secondary/30 px-4 py-3">
                Stop conditions that require picture proof.
              </li>
              <li className="rounded-2xl border border-secondary/30 px-4 py-3">
                Custom reminder frequencies to match your schedule.
              </li>
            </ul>
          </aside>
        </section>
      </div>
    </main>
  );
}
