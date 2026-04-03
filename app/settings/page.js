"use client";

import { useEffect, useState } from "react";
import { formatDateTimeNy } from "../../lib/nyTime";

export default function SettingsPage() {
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [adminReminders, setAdminReminders] = useState([]);
  const [adminListError, setAdminListError] = useState("");
  const [adminActionError, setAdminActionError] = useState("");
  const [isAdminRefreshing, setIsAdminRefreshing] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isAdminAuthed) {
      loadHealth();
      loadAdminReminders();
    }
  }, [isAdminAuthed]);

  async function handleAdminAccess(event) {
    event.preventDefault();
    setAdminError("");
    setAdminListError("");
    setAdminActionError("");
    if (!adminPassword.trim()) {
      setAdminError("Password is required.");
      return;
    }
    setIsAdminLoading(true);
    try {
      const adminHeaders = {
        "x-admin-password": adminPassword,
        Authorization: `Bearer ${adminPassword}`,
      };
      const response = await fetch("/api/admin/reminders", {
        headers: adminHeaders,
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Invalid password.");
      }
      setAdminReminders(payload?.reminders ?? []);
      setIsAdminAuthed(true);
    } catch (error) {
      setAdminError("Invalid password.");
    } finally {
      setIsAdminLoading(false);
    }
  }

  async function loadAdminReminders() {
    setIsAdminRefreshing(true);
    setAdminListError("");
    try {
      const adminHeaders = {
        "x-admin-password": adminPassword,
        Authorization: `Bearer ${adminPassword}`,
      };
      const response = await fetch("/api/admin/reminders", {
        headers: adminHeaders,
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load reminders.");
      }
      setAdminReminders(payload?.reminders ?? []);
    } catch (error) {
      setAdminListError("Unable to load running reminders.");
    } finally {
      setIsAdminRefreshing(false);
    }
  }

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

  const formatFrequency = (reminder) => {
    if (reminder.frequency_type === "custom") {
      return `Every ${reminder.frequency_value} ${reminder.frequency_unit}`;
    }
    const labels = {
      hourly: "Every hour",
      "every-3-hours": "Every 3 hours",
      daily: "Daily",
    };
    return labels[reminder.frequency_type] ?? reminder.frequency_type;
  };

  function notificationDestinations(reminder) {
    const rows = [];
    if (reminder.email && String(reminder.email).trim()) {
      rows.push({
        key: "email",
        label: "Email",
        value: String(reminder.email).trim(),
      });
    }
    if (reminder.phone && String(reminder.phone).trim()) {
      rows.push({
        key: "sms",
        label: "SMS",
        value: String(reminder.phone).trim(),
      });
    }
    if (reminder.telegram_chat_id != null && reminder.telegram_chat_id !== "") {
      rows.push({
        key: "telegram",
        label: "Telegram (chat ID)",
        value: String(reminder.telegram_chat_id),
      });
    }
    return rows;
  }

  async function handleAdminStop(reminderId) {
    setAdminActionError("");
    try {
      const adminHeaders = {
        "x-admin-password": adminPassword,
        Authorization: `Bearer ${adminPassword}`,
      };
      const response = await fetch(`/api/admin/reminders/${reminderId}/stop`, {
        method: "POST",
        headers: adminHeaders,
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to stop reminder.");
      }
      setAdminReminders((prev) =>
        prev.filter((reminder) => reminder.id !== reminderId)
      );
    } catch (error) {
      setAdminActionError("Unable to stop reminder.");
    }
  }

  if (!isAdminAuthed) {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-md px-6 py-16">
          <div className="rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Admin access
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">
              Enter admin password
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              This dashboard is restricted to admins only.
            </p>

            <form className="mt-6 grid gap-3" onSubmit={handleAdminAccess}>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Password
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  className="w-full rounded-2xl border border-orange-200 px-4 py-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </label>
              {adminError ? (
                <p className="text-sm text-rose-500">{adminError}</p>
              ) : null}
              <button
                type="submit"
                disabled={isAdminLoading}
                className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAdminLoading ? "Checking..." : "Unlock settings"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

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
            Verify your Supabase, Vonage, and Resend configuration.
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
                  <p className="text-sm font-semibold text-slate-900">
                    Vonage SMS
                  </p>
                  <p className="text-xs text-slate-500">
                    API key + API secret + sender (number or alphanumeric)
                  </p>
                </div>
                <span className={pillClass(health?.summary?.vonage)}>
                  {health?.summary?.vonage ? "Ready" : "Missing env vars"}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Active reminders (admin)
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                View and stop running reminders. Each card lists where alerts are
                sent (email, phone, or Telegram chat ID).
              </p>
            </div>
            <button
              type="button"
              onClick={loadAdminReminders}
              disabled={isAdminRefreshing}
              className="rounded-full border border-orange-300 px-4 py-2 text-xs font-semibold text-orange-500 transition hover:border-orange-400 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isAdminRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {adminListError ? (
            <p className="mt-3 text-sm text-rose-500">{adminListError}</p>
          ) : null}
          {adminActionError ? (
            <p className="mt-3 text-sm text-rose-500">{adminActionError}</p>
          ) : null}

          {adminReminders.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No active reminders found.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {adminReminders.map((reminder) => {
                const destinations = notificationDestinations(reminder);
                return (
                <div
                  key={reminder.id}
                  className="rounded-2xl border border-orange-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {reminder.message}
                      </p>
                      <p className="text-xs text-slate-500">
                        Recipient: {reminder.recipient_name || "Unknown"}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold text-slate-700">
                          Notifications
                        </p>
                        {destinations.length > 0 ? (
                          <ul className="list-inside list-disc text-xs text-slate-600">
                            {destinations.map((row) => (
                              <li key={row.key}>
                                <span className="font-medium text-slate-700">
                                  {row.label}:
                                </span>{" "}
                                {row.value}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-amber-700">
                            No email, phone, or Telegram chat on this reminder.
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Frequency: {formatFrequency(reminder)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Next run (ET): {formatDateTimeNy(reminder.next_run_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdminStop(reminder.id)}
                      className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
                    >
                      Stop
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Self-test</h2>
          <p className="mt-2 text-sm text-slate-600">
            Send a test email or a direct SMS via Vonage.
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
