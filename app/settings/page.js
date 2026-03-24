"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadHealth();
  }, []);

  async function loadHealth() {
    setIsLoading(true);
    setHealthError("");
    try {
      const response = await fetch("/api/settings/health");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load settings.");
      }
      setHealth(payload);
    } catch (error) {
      setHealthError("Unable to load integration status.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runTest(event) {
    event.preventDefault();
    setTestResult(null);
    setIsTesting(true);
    try {
      const response = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, phone: testPhone }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Test failed.");
      }
      setTestResult(payload.results);
    } catch (error) {
      setTestResult({ error: "Unable to run test." });
    } finally {
      setIsTesting(false);
    }
  }

  const pillClass = (active) =>
    `rounded-full border px-3 py-1 text-xs font-semibold ${
      active
        ? "border-orange-400 bg-orange-50 text-orange-600"
        : "border-slate-200 text-slate-500"
    }`;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Settings
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Integrations & health checks
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Verify your Supabase, Twilio, and Resend configuration.
            </p>
          </div>
          <button
            type="button"
            onClick={loadHealth}
            className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
          >
            Refresh status
          </button>
        </div>

        <section className="mt-8 rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Environment status
          </h2>
          {healthError ? (
            <p className="mt-2 text-sm text-rose-500">{healthError}</p>
          ) : null}
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Checking...</p>
          ) : (
            <div className="mt-4 grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-orange-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Supabase connection
                  </p>
                  <p className="text-xs text-slate-500">
                    URL + service key + reminders table
                  </p>
                </div>
                <span className={pillClass(health?.summary?.supabase)}>
                  {health?.summary?.supabase ? "Connected" : "Needs setup"}
                </span>
              </div>
              {health?.supabaseError ? (
                <p className="text-xs text-rose-500">
                  Supabase error: {health.supabaseError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-orange-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Resend</p>
                  <p className="text-xs text-slate-500">
                    API key + from address
                  </p>
                </div>
                <span className={pillClass(health?.summary?.resend)}>
                  {health?.summary?.resend ? "Ready" : "Missing env vars"}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-orange-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Twilio</p>
                  <p className="text-xs text-slate-500">
                    SID + token + sending number
                  </p>
                </div>
                <span className={pillClass(health?.summary?.twilio)}>
                  {health?.summary?.twilio ? "Ready" : "Missing env vars"}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Self-test</h2>
          <p className="mt-2 text-sm text-slate-600">
            Send a test message to confirm Twilio and Resend are configured.
          </p>

          <form className="mt-4 grid gap-4" onSubmit={runTest}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Test email (optional)
              <input
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-orange-200 px-4 py-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Test phone (optional)
              <input
                type="tel"
                value={testPhone}
                onChange={(event) => setTestPhone(event.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full rounded-2xl border border-orange-200 px-4 py-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <button
              type="submit"
              disabled={isTesting}
              className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isTesting ? "Sending..." : "Run test"}
            </button>
          </form>

          {testResult ? (
            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-slate-700">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
