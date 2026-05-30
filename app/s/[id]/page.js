import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { verifyStopToken } from "../../../lib/stopToken";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Stop reminder — Reminder Rocket",
};

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * @param {string | null | undefined} id
 * @param {string | null | undefined} token
 * @returns {Promise<{ status: "stopped" | "already" | "needs-proof" | "not-found" | "invalid" | "error", message?: string }>}
 */
async function processStop(id, token) {
  if (!id || !verifyStopToken(id, token)) {
    return { status: "invalid" };
  }
  const supabase = getServiceRoleClient();
  if (!supabase) {
    return { status: "error", message: "Server misconfigured." };
  }

  const { data: reminder, error: fetchError } = await supabase
    .from("reminders")
    .select("id, status, stop_condition, proof_url, message")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !reminder) {
    return { status: "not-found" };
  }

  if (reminder.status === "completed") {
    return { status: "already", message: reminder.message };
  }

  if (reminder.stop_condition === "proof" && !reminder.proof_url) {
    return { status: "needs-proof", message: reminder.message };
  }

  const { error: updateError } = await supabase
    .from("reminders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    return { status: "error", message: updateError.message };
  }

  return { status: "stopped", message: reminder.message };
}

export default async function StopReminderPage({ params, searchParams }) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearch = await Promise.resolve(searchParams);
  const id = resolvedParams?.id ?? null;
  const token = typeof resolvedSearch?.t === "string" ? resolvedSearch.t : null;

  const result = await processStop(id, token);

  const headlines = {
    stopped: "✅ Reminder stopped",
    already: "✓ Already stopped",
    "needs-proof": "📸 Proof required",
    "not-found": "⚠️ Reminder not found",
    invalid: "🛑 Link expired or invalid",
    error: "⚠️ Something went wrong",
  };

  const blurbs = {
    stopped: "We marked it complete and won't ping you again.",
    already: "This reminder was already stopped — nothing to do.",
    "needs-proof":
      "This reminder requires a photo proof to complete. Open the app or send a photo to the bot.",
    "not-found":
      "Couldn't find that reminder. It may have been deleted or the link mistyped.",
    invalid:
      "This stop link is missing its security token or doesn't match. Try the link straight from the most recent SMS.",
    error:
      result.message ||
      "An unexpected error happened on our side. Try again in a moment.",
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-12">
        <div className="w-full rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
            Reminder Rocket
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            {headlines[result.status]}
          </h1>
          {result.message && result.status !== "error" ? (
            <p className="mt-2 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-slate-700">
              {result.message}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-slate-600">
            {blurbs[result.status]}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Back to Reminder Rocket
          </Link>
        </div>
      </div>
    </main>
  );
}
