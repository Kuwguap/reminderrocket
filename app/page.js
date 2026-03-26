"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../lib/supabaseBrowser";
import { formatZodErrors, reminderSchema } from "../lib/validation";

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
    shortLabel: "Hourly",
    detail: "Best for short, urgent tasks.",
  },
  {
    id: "every-3-hours",
    label: "Every 3 hours",
    shortLabel: "3 hr",
    detail: "Steady check-ins across the day.",
  },
  {
    id: "daily",
    label: "Daily",
    shortLabel: "Daily",
    detail: "A single prompt each day.",
  },
  {
    id: "custom",
    label: "Custom",
    shortLabel: "Custom",
    detail: "Pick your own interval.",
  },
];

const stopOptions = [
  { value: "time", label: "End at a specific time" },
  { value: "proof", label: "Require picture proof" },
];

export default function Home() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [frequency, setFrequency] = useState("hourly");
  const [annoyMode, setAnnoyMode] = useState(false);
  const [startTiming, setStartTiming] = useState("now");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [customFrequencyValue, setCustomFrequencyValue] = useState("");
  const [customFrequencyUnit, setCustomFrequencyUnit] = useState("minutes");
  const [scheduledAt, setScheduledAt] = useState("");
  const [stopCondition, setStopCondition] = useState("proof");
  const [stopAt, setStopAt] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [clientId, setClientId] = useState("");

  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch (error) {
      return null;
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((current) => (current + 1) % quotes.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const key = "rr_client_id";
    let stored = window.localStorage.getItem(key);
    if (!stored) {
      const fallbackUuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        (char) => {
          const rand = Math.floor(Math.random() * 16);
          const value = char === "x" ? rand : (rand & 0x3) | 0x8;
          return value.toString(16);
        }
      );
      stored = window.crypto?.randomUUID?.() ?? fallbackUuid;
      window.localStorage.setItem(key, stored);
    }
    setClientId(stored);
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let isActive = true;

    const syncSessionUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isActive) {
        return;
      }
      setUser(data.session?.user ?? null);
    };

    syncSessionUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (isActive) {
          setUser(session?.user ?? null);
        }
      }
    );
    const sessionPoll = setInterval(syncSessionUser, 60 * 1000);
    return () => {
      isActive = false;
      clearInterval(sessionPoll);
      subscription?.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (user) {
      loadReminders();
      return;
    }
    setReminders([]);
    setListError("");
    setIsLoadingReminders(false);
  }, [user, clientId]);

  async function loadReminders() {
    setIsLoadingReminders(true);
    setListError("");
    try {
      const params = new URLSearchParams({ status: "active" });
      if (!user && clientId) {
        params.set("client_id", clientId);
      }
      const response = await fetch(`/api/reminders?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load reminders.");
      }
      setReminders(payload.reminders ?? []);
    } catch (error) {
      setListError("Unable to load reminders.");
    } finally {
      setIsLoadingReminders(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormErrors({});
    setSubmitError("");
    setSubmitSuccess("");

    if (!user && !clientId) {
      setSubmitError("Missing device session. Refresh the page and try again.");
      return;
    }

    const startTime =
      startTiming === "now"
        ? new Date()
        : scheduledAt
        ? new Date(scheduledAt)
        : null;
    const stopTime =
      stopCondition === "time" && stopAt ? new Date(stopAt) : null;

    const selectedFrequency = annoyMode ? "annoy" : frequency;
    const payload = {
      client_id: clientId || null,
      message: message.trim(),
      recipient_name: "You",
      phone,
      email,
      frequency_type: selectedFrequency,
      frequency_value:
        !annoyMode && frequency === "custom" ? customFrequencyValue : null,
      frequency_unit:
        !annoyMode && frequency === "custom" ? customFrequencyUnit : null,
      start_time: startTime ? startTime.toISOString() : "",
      stop_condition: stopCondition,
      stop_at: stopTime ? stopTime.toISOString() : null,
    };

    const parsed = reminderSchema.safeParse(payload);
    if (!parsed.success) {
      setFormErrors(formatZodErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const rawText = await response.text();
      let responseBody = null;
      try {
        responseBody = rawText ? JSON.parse(rawText) : null;
      } catch (_error) {
        responseBody = null;
      }

      if (!response.ok) {
        if (responseBody?.errors) {
          setFormErrors(responseBody.errors);
        }
        setSubmitError(
          responseBody?.error ||
            `Unable to launch reminder (HTTP ${response.status}).${
              rawText ? ` ${rawText.slice(0, 220)}` : ""
            }`
        );
        return;
      }

      setSubmitSuccess("");
      setMessage("");
      setPhone("");
      setEmail("");
      setFrequency("hourly");
      setCustomFrequencyValue("");
      setCustomFrequencyUnit("minutes");
      setAnnoyMode(false);
      setStartTiming("now");
      setScheduledAt("");
      setStopCondition("proof");
      setStopAt("");
      await loadReminders();
      setShowSuccessModal(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      console.error("Create reminder failed:", error);
      setSubmitError(`Something went wrong while creating the reminder. ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStopReminder(reminderId) {
    setActionError("");
    try {
      const query = !user && clientId ? `?client_id=${clientId}` : "";
      const response = await fetch(`/api/reminders/${reminderId}/stop${query}`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to stop reminder.");
      }
      await loadReminders();
    } catch (error) {
      setActionError("Unable to stop reminder.");
    }
  }

  async function handleProofUpload(reminderId, file) {
    if (!file) {
      return;
    }

    setActionError("");
    setUploadingId(reminderId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const query = !user && clientId ? `?client_id=${clientId}` : "";
      const response = await fetch(`/api/reminders/${reminderId}/proof${query}`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to upload proof.");
      }
      await loadReminders();
    } catch (error) {
      setActionError("Unable to upload proof.");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setAuthError("");
    if (!supabase) {
      setAuthError("Supabase auth is not configured.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) {
        setAuthError(error.message);
        return;
      }
      setShowAuth(false);
      setAuthEmail("");
      setAuthPassword("");
    } catch (error) {
      setAuthError("Unable to sign in.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleSignUp() {
    setAuthError("");
    if (!supabase) {
      setAuthError("Supabase auth is not configured.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
      if (error) {
        setAuthError(error.message);
        return;
      }
      if (data?.session) {
        setShowAuth(false);
        setAuthEmail("");
        setAuthPassword("");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (signInError) {
        setAuthError(
          "Account created. Disable email confirmations in Supabase to sign in instantly."
        );
        return;
      }
      setShowAuth(false);
      setAuthEmail("");
      setAuthPassword("");
    } catch (error) {
      setAuthError("Unable to create account.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleSignOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setShowMenu(false);
  }

  const primaryButtonClass =
    "cursor-pointer rounded-full bg-orange-500 px-[22px] py-[10px] text-[13px] font-semibold text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-70";
  const primaryButtonSmallClass =
    "cursor-pointer rounded-full bg-orange-500 px-[14px] py-[6px] text-[11px] font-semibold text-white transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-70";

  const renderError = (field) =>
    formErrors[field] ? (
      <span className="text-xs text-rose-500">{formErrors[field]}</span>
    ) : null;

  const formatDateTime = (value) => {
    if (!value) {
      return "—";
    }
    return new Date(value).toLocaleString("en-US", {
      timeZone: "America/New_York",
    });
  };

  const formatFrequency = (reminder) => {
    if (reminder.frequency_type === "annoy") {
      return "Annoy me until done";
    }
    if (reminder.frequency_type === "custom") {
      return `Every ${reminder.frequency_value} ${reminder.frequency_unit}`;
    }
    const option = frequencyOptions.find(
      (item) => item.id === reminder.frequency_type
    );
    return option?.label ?? reminder.frequency_type;
  };

  const visibleReminders = reminders.slice(0, 4);
  const hiddenReminderCount = Math.max(reminders.length - visibleReminders.length, 0);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-5 py-4">
        {/* <header className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-2 rounded-full border border-orange-400 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Reminder Rocket 🚀
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Start now, stay on track.
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Launch reminders fast, stay accountable, and finish the mission.
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="rounded-full border border-orange-300 px-4 py-2 text-xs font-semibold text-orange-500 transition hover:border-orange-400 hover:text-orange-600"
            >
              Menu
            </button>
            {showMenu ? (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-orange-200 bg-white p-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowReminders(true);
                    setShowMenu(false);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50"
                >
                  Active reminders
                </button>
                {user ? (
                  <div className="mt-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs text-slate-600">
                    Signed in as
                    <span className="mt-1 block font-semibold text-slate-900">
                      {user.email}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAuth(true);
                      setShowMenu(false);
                    }}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50"
                  >
                    Sign in / Create account
                  </button>
                )}
                {user ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50"
                  >
                    Sign out
                  </button>
                ) : null}
                <a
                  href="/settings"
                  className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50"
                >
                  Settings
                </a>
              </div>
            ) : null}
          </div>
        </header> */}

        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-3xl border border-orange-200 bg-white p-[18px] shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-slate-900">
                Create a reminder
              </h2>
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:text-emerald-800"
                >
                  Log out
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  className="rounded-full border border-orange-400 px-3 py-1 text-xs font-semibold text-orange-500 transition hover:border-orange-500 hover:text-orange-600"
                >
                  Sign in
                </Link>
              )}
            </div>

            <form className="mt-[10px] grid gap-[8px]" onSubmit={handleSubmit}>
              {submitError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-[14px] py-[10px] text-[11px] text-rose-600">
                  {submitError}
                </div>
              ) : null}
              {submitSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-[14px] py-[10px] text-[11px] text-emerald-600">
                  {submitSuccess}
                </div>
              ) : null}

              <div className="grid gap-[6px] rounded-2xl border border-orange-200 bg-orange-50/40 px-[10px] py-[10px]">
                <p className="text-center text-[12px] font-black uppercase tracking-[0.2em] text-orange-600">
                  Step 1 — Reminder
                </p>
                <label className="grid gap-[3px] text-[11px] font-medium text-slate-700">
                  <span className="sr-only">Reminder message</span>
                  <textarea
                    rows={2}
                    placeholder="Remind me to..."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="w-full resize-none rounded-2xl border border-orange-200 bg-white px-[10px] py-[6px] text-[13px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  {renderError("message")}
                </label>
              </div>

              <div className="grid gap-[6px] rounded-2xl border border-orange-200 bg-orange-50/40 px-[10px] py-[10px]">
                <p className="text-center text-[12px] font-black uppercase tracking-[0.2em] text-orange-600">
                  Step 2 — Start
                </p>
                <div className="text-[11px] font-medium text-slate-700">
                  How often (tap one)
                  <div
                    className={`mt-1 flex flex-nowrap gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${annoyMode ? "pointer-events-none opacity-40" : ""}`}
                  >
                    {frequencyOptions.map((option) => {
                      const isActive = frequency === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setFrequency(option.id)}
                          aria-pressed={isActive}
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-center text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:px-3 sm:text-[11px] ${
                            isActive
                              ? "border-orange-400 bg-orange-50 text-orange-500"
                              : "border-orange-200 bg-white text-slate-700 hover:border-orange-300"
                          }`}
                        >
                          {option.shortLabel ?? option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {!annoyMode && frequency === "custom" ? (
                  <div className="grid gap-[6px] sm:grid-cols-[1fr,120px]">
                    <input
                      type="number"
                      min={5}
                      step={5}
                      placeholder="30"
                      value={customFrequencyValue}
                      onChange={(event) =>
                        setCustomFrequencyValue(event.target.value)
                      }
                      className="w-full rounded-2xl border border-orange-200 bg-white px-[10px] py-[6px] text-[13px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <select
                      value={customFrequencyUnit}
                      onChange={(event) =>
                        setCustomFrequencyUnit(event.target.value)
                      }
                      className="w-full rounded-2xl border border-orange-200 bg-white px-[10px] py-[6px] text-[13px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                ) : null}
                {renderError("frequency_value")}

                <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-orange-200 bg-white px-[10px] py-[8px]">
                  <input
                    type="checkbox"
                    checked={annoyMode}
                    onChange={(event) => setAnnoyMode(event.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="grid gap-1 text-[11px] text-slate-700">
                    <span className="font-semibold text-slate-900">
                      Annoy me until done
                    </span>
                  </span>
                </label>

                <div className="grid gap-[10px] rounded-2xl border border-orange-100 bg-white px-[10px] py-[10px] md:grid-cols-2">
                  <div className="grid gap-[3px] text-[11px] font-medium text-slate-700">
                    Start time
                    <div className="flex flex-wrap items-center gap-2">
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
                    {startTiming === "schedule" ? (
                      <label className="grid gap-[3px] text-[11px] font-medium text-slate-600">
                        Scheduled start
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(event) => setScheduledAt(event.target.value)}
                          className="w-full rounded-2xl border border-orange-200 px-[10px] py-[6px] text-[13px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        {renderError("start_time")}
                      </label>
                    ) : null}
                  </div>

                  <div className="grid gap-[3px] text-[11px] font-medium text-slate-700">
                    Stop condition
                    <select
                      value={stopCondition}
                      onChange={(event) => setStopCondition(event.target.value)}
                      className="w-full rounded-2xl border border-orange-200 px-[10px] py-[6px] text-[13px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {stopOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {stopCondition === "time" ? (
                      <label className="grid gap-[3px] text-[11px] font-medium text-slate-600">
                        Stop time
                        <input
                          type="datetime-local"
                          value={stopAt}
                          onChange={(event) => setStopAt(event.target.value)}
                          className="w-full rounded-2xl border border-orange-200 px-[10px] py-[6px] text-[13px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        {renderError("stop_at")}
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-[6px] rounded-2xl border border-orange-200 bg-orange-50/40 px-[10px] py-[10px]">
                <p className="text-center text-[12px] font-black uppercase tracking-[0.2em] text-orange-600">
                  Step 3 — Contact
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-[3px] text-[11px] font-medium text-slate-700">
                    Text Rocket
                    <input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="w-full rounded-2xl border border-orange-200 bg-white px-[10px] py-[6px] text-[13px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {renderError("phone")}
                  </label>

                  <label className="grid gap-[3px] text-[11px] font-medium text-slate-700">
                    Email Rocket
                    <input
                      type="email"
                      placeholder="rocket@launch.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-2xl border border-orange-200 bg-white px-[10px] py-[6px] text-[13px] text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {renderError("email")}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className={`mt-2 ${primaryButtonClass}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  "Launching..."
                ) : (
                  <>
                    Launch rocket
                    <span className="ml-1 inline-block animate-spin">🚀</span>
                  </>
                )}
              </button>
            </form>

            {user ? (
              <div className="mt-[10px] rounded-2xl border border-orange-200 px-[10px] py-[6px] text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-900">
                    Active reminders:{" "}
                    {isLoadingReminders ? "Loading..." : reminders.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowReminders(true)}
                    className="rounded-full border border-orange-300 px-[10px] py-[4px] text-[11px] font-semibold text-orange-500 transition hover:border-orange-400 hover:text-orange-600"
                  >
                    View
                  </button>
                </div>
                {listError ? (
                  <p className="mt-1 text-[11px] text-rose-500">{listError}</p>
                ) : null}
                {actionError ? (
                  <p className="mt-1 text-[11px] text-rose-500">{actionError}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* <aside className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              What stays in orbit
            </h3>
            <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                Mission control
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                "{quotes[quoteIndex]}"
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Rotating quotes update every few seconds.
              </p>
            </div>
            <ul className="mt-4 grid gap-3 text-xs text-slate-600">
              <li className="rounded-2xl border border-orange-300 px-3 py-2">
                Dual-channel delivery via SMS and email.
              </li>
              <li className="rounded-2xl border border-orange-300 px-3 py-2">
                Flexible recipients for yourself or someone special.
              </li>
            </ul>
          </aside> */}
        </section>

        {showSuccessModal ? (
          <div className="fixed inset-0 z-[25] flex items-center justify-center bg-slate-950/45 px-4">
            <div className="w-full max-w-sm rounded-3xl border-2 border-orange-400 bg-white p-5 shadow-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                Reminder Rocket
              </p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">
                Reminder launched
              </h3>
              <p className="mt-1 text-[12px] text-slate-600">
                You’re set. Add another mission or sign in to keep reminders
                across devices.
              </p>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full rounded-full bg-orange-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  Add another reminder
                </button>
                <Link
                  href="/sign-in"
                  onClick={() => setShowSuccessModal(false)}
                  className="block w-full rounded-full border border-orange-400 py-2.5 text-center text-[12px] font-semibold text-orange-600 transition hover:border-orange-500 hover:text-orange-700"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {showReminders && user ? (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 px-4">
            <div className="w-full max-w-xl rounded-3xl border border-orange-200 bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Active reminders
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadReminders}
                    className="rounded-full border border-orange-300 px-3 py-1 text-xs font-semibold text-orange-500 transition hover:border-orange-400 hover:text-orange-600"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReminders(false)}
                    className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-orange-600"
                  >
                    Close
                  </button>
                </div>
              </div>

              {listError ? (
                <p className="mt-2 text-xs text-rose-500">{listError}</p>
              ) : null}
              {actionError ? (
                <p className="mt-2 text-xs text-rose-500">{actionError}</p>
              ) : null}

              {isLoadingReminders ? (
                <p className="mt-3 text-sm text-slate-500">
                  Loading reminders...
                </p>
              ) : reminders.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No active reminders yet.
                </p>
              ) : (
                <div className="mt-3 grid gap-3">
                  {visibleReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="rounded-2xl border border-orange-200 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {reminder.message}
                          </p>
                          <p className="text-xs text-slate-500">
                            Recipient: {reminder.recipient_name || "Recipient"}
                          </p>
                          <p className="text-xs text-slate-500">
                            Next run: {formatDateTime(reminder.next_run_at)}
                          </p>
                          {reminder.stop_condition === "proof" ? (
                            <p className="text-xs text-slate-500">
                              Proof required
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Stops: {formatDateTime(reminder.stop_at)}
                            </p>
                          )}
                        </div>
                        {reminder.stop_condition === "proof" &&
                        !reminder.proof_url ? null : (
                          <button
                            type="button"
                            onClick={() => handleStopReminder(reminder.id)}
                            className={primaryButtonSmallClass}
                          >
                            Stop
                          </button>
                        )}
                      </div>

                      {reminder.stop_condition === "proof" &&
                      !reminder.proof_url ? (
                        <div className="mt-2 grid gap-2">
                          <p className="text-xs text-slate-500">
                            Upload proof to complete this reminder.
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              handleProofUpload(
                                reminder.id,
                                event.target.files?.[0]
                              )
                            }
                            className="text-xs text-slate-600"
                          />
                          {uploadingId === reminder.id ? (
                            <p className="text-xs text-slate-500">
                              Uploading...
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {hiddenReminderCount > 0 ? (
                    <p className="text-xs text-slate-500">
                      Showing latest {visibleReminders.length} of{" "}
                      {reminders.length} reminders.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {showAuth ? (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 px-4">
            <div className="w-full max-w-sm rounded-3xl border border-orange-200 bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Account access
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAuth(false)}
                  className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-orange-600"
                >
                  Close
                </button>
              </div>

              <form className="mt-3 grid gap-3" onSubmit={handleSignIn}>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Email
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    className="w-full rounded-2xl border border-orange-200 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Password
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    className="w-full rounded-2xl border border-orange-200 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </label>
                {authError ? (
                  <p className="text-xs text-rose-500">{authError}</p>
                ) : null}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isAuthLoading ? "Signing in..." : "Sign in"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignUp}
                    disabled={isAuthLoading}
                    className="rounded-full border border-orange-300 px-4 py-2 text-xs font-semibold text-orange-500 transition hover:border-orange-400 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Create account
                  </button>
                </div>
              </form>
              <p className="mt-3 text-xs text-slate-500">
                Continue without an account to use local device reminders only.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
