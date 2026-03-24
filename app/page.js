export default function Home() {
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
              className="cursor-pointer rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              Start now
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
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
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Recipient name
                <input
                  type="text"
                  placeholder="Someone special"
                  className="w-full rounded-2xl border border-secondary/20 px-4 py-3 text-sm text-slate-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </label>

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

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Frequency
                <select className="w-full rounded-2xl border border-secondary/20 px-4 py-3 text-sm text-slate-900 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary">
                  <option>Every hour</option>
                  <option>Every 3 hours</option>
                  <option>Daily</option>
                  <option>Custom</option>
                </select>
              </label>

              <div className="grid gap-2 text-sm font-medium text-slate-700">
                Start time
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="cursor-pointer rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-white transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                  >
                    Start now
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-white transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
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
                className="mt-2 cursor-pointer rounded-2xl bg-secondary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                Launch reminder
              </button>
            </form>
          </div>

          <aside className="rounded-3xl border border-secondary/20 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              What stays in orbit
            </h3>
            <ul className="mt-4 grid gap-4 text-sm text-slate-600">
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
