import { serve } from "https://deno.land/std@0.214.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL");
const VONAGE_API_KEY =
  Deno.env.get("VONAGE_API_KEY")?.trim() ||
  Deno.env.get("NEXMO_API_KEY")?.trim() ||
  "";
const VONAGE_API_SECRET =
  Deno.env.get("VONAGE_API_SECRET")?.trim() ||
  Deno.env.get("NEXMO_API_SECRET")?.trim() ||
  "";
const VONAGE_SMS_FROM =
  Deno.env.get("VONAGE_SMS_FROM")?.trim() ||
  Deno.env.get("VONAGE_FROM_NUMBER")?.trim() ||
  Deno.env.get("VONAGE_FROM")?.trim() ||
  "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "";

const requiredEnv = [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
].filter(([, value]) => !value);

const hasResend =
  Boolean(RESEND_API_KEY) && Boolean(RESEND_FROM_EMAIL);
const hasVonage = Boolean(
  VONAGE_API_KEY && VONAGE_API_SECRET && VONAGE_SMS_FROM
);
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_SERVICE_ROLE_KEY ?? "");

async function sendTelegramDm(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN." };
  }
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4090),
        disable_web_page_preview: true,
      }),
    }
  );
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    return {
      ok: false,
      error: payload?.description ?? `HTTP ${response.status}`,
    };
  }
  return { ok: true };
}

function getIntervalMs(reminder: {
  frequency_type: string;
  frequency_value?: number | null;
  frequency_unit?: string | null;
}) {
  switch (reminder.frequency_type) {
    case "hourly":
      return 60 * 60 * 1000;
    case "every-3-hours":
      return 3 * 60 * 60 * 1000;
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "annoy":
      return 5 * 60 * 1000;
    case "custom": {
      const value = reminder.frequency_value ?? 0;
      const unit = reminder.frequency_unit ?? "minutes";
      const multiplier =
        unit === "minutes"
          ? 60 * 1000
          : unit === "hours"
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
      return value > 0 ? value * multiplier : null;
    }
    default:
      return null;
  }
}

async function getAnnoyMeta(reminderId: string, channel: string) {
  const { count, error } = await supabase
    .from("reminder_attempts")
    .select("id", { count: "exact", head: true })
    .eq("reminder_id", reminderId)
    .eq("channel", channel)
    .eq("status", "sent");

  const attemptCount = error ? 0 : count ?? 0;
  const tone =
    attemptCount === 0
      ? "Hey, did you do it?"
      : attemptCount === 1
      ? "You're ignoring this."
      : "Last warning.";
  const intervalMs =
    attemptCount === 0
      ? 5 * 60 * 1000
      : attemptCount === 1
      ? 15 * 60 * 1000
      : 60 * 60 * 1000;

  return { tone, intervalMs, attemptCount };
}

async function logAttempt(reminderId: string, channel: string, status: string, error?: string) {
  await supabase.from("reminder_attempts").insert({
    reminder_id: reminderId,
    channel,
    status,
    error_message: error ?? null,
  });
}

function normalizeSmsDestination(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length >= 8) {
    return `+${digitsOnly}`;
  }
  return null;
}

function toVonageMsisdn(e164: string): string | null {
  const digits = e164.replace(/^\+/, "").replace(/\D/g, "");
  return digits || null;
}

function formatVonageFrom(from: string): string {
  const t = from.trim();
  if (!t) {
    return "";
  }
  if (/^\d/.test(t) || t.startsWith("+")) {
    return t.replace(/^\+/, "").replace(/\D/g, "");
  }
  return t.slice(0, 11);
}

async function sendVonageSms(to: string, body: string) {
  const toE164 = normalizeSmsDestination(to);
  const toMsisdn = toE164 ? toVonageMsisdn(toE164) : null;
  if (!toMsisdn) {
    throw new Error(
      "Invalid phone number. Use E.164 (e.g. +15551234567 or US 10-digit)."
    );
  }

  const payload = {
    api_key: VONAGE_API_KEY,
    api_secret: VONAGE_API_SECRET,
    to: toMsisdn,
    from: formatVonageFrom(VONAGE_SMS_FROM),
    text: body.slice(0, 1600),
  };

  const response = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: { messages?: Array<Record<string, unknown>> };
  try {
    data = JSON.parse(text) as { messages?: Array<Record<string, unknown>> };
  } catch {
    throw new Error(text || `Vonage request failed (${response.status}).`);
  }

  const first = data?.messages?.[0];
  if (!first) {
    throw new Error(text || "Vonage returned an unexpected response.");
  }

  const status = String(first.status ?? "");
  if (status !== "0") {
    const err =
      (first["error-text"] as string) ||
      (first["error_text"] as string) ||
      `Vonage SMS failed (status ${status}).`;
    throw new Error(err);
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Resend send failed.");
  }
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMultiline(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

/** Display timestamps in US Eastern; keep in sync with `lib/nyTime.js` `formatDateTimeNy`. */
function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
}

function getFrequencyLabel(reminder: {
  frequency_type: string;
  frequency_value?: number | null;
  frequency_unit?: string | null;
}) {
  if (reminder.frequency_type === "annoy") {
    return "Annoy me until done";
  }
  if (reminder.frequency_type === "custom") {
    return `Every ${reminder.frequency_value} ${reminder.frequency_unit}`;
  }
  const labels: Record<string, string> = {
    hourly: "Every hour",
    "every-3-hours": "Every 3 hours",
    daily: "Daily",
  };
  return labels[reminder.frequency_type] ?? reminder.frequency_type;
}

function buildUploadUrl(reminder: { id: string; client_id?: string | null }) {
  if (!APP_BASE_URL) {
    return null;
  }
  const base = APP_BASE_URL.replace(/\/+$/, "");
  const url = new URL(`${base}/upload/${reminder.id}`);
  if (reminder.client_id) {
    url.searchParams.set("client_id", reminder.client_id);
  }
  return url.toString();
}

function buildReminderEmail(params: {
  title: string;
  subtitle?: string | null;
  message: string;
  details: Array<{ label: string; value: string }>;
  ctaUrl?: string;
  ctaLabel?: string;
  secondaryCtaUrl?: string;
  secondaryCtaLabel?: string;
}) {
  const detailRows = params.details
    .map(
      (item) => `
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-size: 12px; width: 120px;">${escapeHtml(
          item.label
        )}</td>
        <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 600;">${escapeHtml(
          item.value
        )}</td>
      </tr>`
    )
    .join("");

  const subtitleBlock = params.subtitle
    ? `<p style="margin: 4px 0 12px; color: #475569; font-size: 14px; text-align: center;">${escapeHtml(
        params.subtitle
      )}</p>`
    : "";

  const uploadButton = params.secondaryCtaUrl
    ? `<a href="${escapeHtml(
        params.secondaryCtaUrl
      )}" style="display: inline-block; margin-top: 10px; border: 1px solid #fb923c; color: #f97316; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 999px;">${escapeHtml(
        params.secondaryCtaLabel ?? "Upload receipt"
      )}</a>`
    : "";

  const primaryButton = params.ctaUrl
    ? `<a href="${escapeHtml(
        params.ctaUrl
      )}" style="display: inline-block; margin-top: ${
        uploadButton ? "8px" : "12px"
      }; background-color: #f97316; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 999px;">${escapeHtml(
        params.ctaLabel ?? "Complete the mission"
      )}</a>`
    : "";

  return `
  <div style="background-color: #ffffff; padding: 16px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a;">
    <div style="max-width: 560px; margin: 0 auto; border: 1px solid #fed7aa; border-radius: 24px; padding: 20px;">
      <div style="text-align: center; color: #f97316; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-weight: 700; margin-bottom: 10px;">
        Reminder Rocket
      </div>
      <h1 style="margin: 0 0 8px; font-size: 22px; text-align: center;">${escapeHtml(
        params.title
      )}</h1>
      ${subtitleBlock}
      <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 18px; padding: 16px;">
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #0f172a;">
          ${formatMultiline(params.message)}
        </p>
      </div>
      ${uploadButton}
      ${primaryButton}
      <table style="width: 100%; margin: 16px 0 0; border-collapse: collapse;">
        ${detailRows}
      </table>
      <p style="margin-top: 16px; font-size: 11px; color: #94a3b8;">
        Stay on track and finish the mission.
      </p>
    </div>
  </div>`;
}

serve(async () => {
  if (requiredEnv.length > 0) {
    return new Response(
      JSON.stringify({
        error: `Missing env: ${requiredEnv.map(([key]) => key).join(", ")}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: dueReminders, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", nowIso);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const processed: string[] = [];

  for (const reminder of dueReminders ?? []) {
    let delivered = false;
    let hasConfiguredChannel = false;

    const stopAt = reminder.stop_at ? new Date(reminder.stop_at) : null;
    if (reminder.stop_condition === "time" && stopAt && stopAt <= now) {
      await supabase
        .from("reminders")
        .update({ status: "completed", completed_at: nowIso })
        .eq("id", reminder.id);
      continue;
    }

    const annoyChannel = reminder.phone
      ? "sms"
      : reminder.email
      ? "email"
      : "telegram";
    const annoyMeta =
      reminder.frequency_type === "annoy"
        ? await getAnnoyMeta(reminder.id, annoyChannel)
        : null;
    const intervalMs =
      reminder.frequency_type === "annoy"
        ? annoyMeta?.intervalMs
        : getIntervalMs(reminder);
    if (!intervalMs) {
      await logAttempt(reminder.id, "system", "failed", "Invalid frequency.");
      continue;
    }

    const uploadUrl =
      reminder.stop_condition === "proof" ? buildUploadUrl(reminder) : null;
    const smsMessage = annoyMeta?.tone
      ? `${annoyMeta.tone}\n${reminder.message}`
      : reminder.message;

    if (reminder.phone) {
      try {
        if (!hasVonage) {
          await logAttempt(
            reminder.id,
            "sms",
            "skipped",
            "Missing Vonage configuration."
          );
        } else {
          hasConfiguredChannel = true;
          await sendVonageSms(reminder.phone, smsMessage);
          await logAttempt(reminder.id, "sms", "sent");
          delivered = true;
        }
      } catch (error) {
        await logAttempt(reminder.id, "sms", "failed", String(error));
      }
    }

    if (reminder.email) {
      try {
        if (!hasResend) {
          await logAttempt(
            reminder.id,
            "email",
            "skipped",
            "Missing Resend env vars."
          );
        } else {
          hasConfiguredChannel = true;
          const html = buildReminderEmail({
            title: "Reminder alert",
            subtitle: null,
            message: reminder.message,
            details: [
              { label: "Recipient", value: reminder.recipient_name || "You" },
              { label: "Frequency", value: getFrequencyLabel(reminder) },
              { label: "Next run", value: formatDateTime(reminder.next_run_at) },
              {
                label: "Stop condition",
                value:
                  reminder.stop_condition === "proof"
                    ? "Picture proof required"
                    : `Stop at ${formatDateTime(reminder.stop_at)}`,
              },
            ],
            ctaUrl: APP_BASE_URL || undefined,
            ctaLabel: "Complete the mission",
            secondaryCtaUrl:
              reminder.stop_condition === "proof"
                ? buildUploadUrl(reminder)
                : undefined,
            secondaryCtaLabel: "Upload receipt",
          });
          await sendEmail(reminder.email, "Reminder Rocket", html);
          await logAttempt(reminder.id, "email", "sent");
          delivered = true;
        }
      } catch (error) {
        await logAttempt(reminder.id, "email", "failed", String(error));
      }
    }

    if (reminder.telegram_chat_id != null) {
      try {
        if (!TELEGRAM_BOT_TOKEN) {
          await logAttempt(
            reminder.id,
            "telegram",
            "skipped",
            "Missing TELEGRAM_BOT_TOKEN."
          );
        } else {
          hasConfiguredChannel = true;
          const tgBody = [
            "🔔 Reminder Rocket",
            "",
            smsMessage,
            "",
            `Next run (ET): ${formatDateTime(reminder.next_run_at)}`,
            reminder.stop_condition === "proof"
              ? `\nStop: picture proof required${
                  uploadUrl ? `\n${uploadUrl}` : ""
                }`
              : reminder.stop_at
              ? `\nStop (ET): ${formatDateTime(reminder.stop_at)}`
              : "",
          ]
            .filter((line) => line !== "")
            .join("\n");
          const tgResult = await sendTelegramDm(
            Number(reminder.telegram_chat_id),
            tgBody
          );
          if (!tgResult.ok) {
            await logAttempt(
              reminder.id,
              "telegram",
              "failed",
              tgResult.error ?? "Telegram failed"
            );
          } else {
            await logAttempt(reminder.id, "telegram", "sent");
            delivered = true;
          }
        }
      } catch (error) {
        await logAttempt(reminder.id, "telegram", "failed", String(error));
      }
    }

    const shouldAdvance = delivered || !hasConfiguredChannel;

    if (shouldAdvance) {
      const nextRunAt = new Date(now.getTime() + intervalMs);
      const updates: Record<string, string> = {
        next_run_at: nextRunAt.toISOString(),
      };

      if (delivered) {
        updates.last_sent_at = nowIso;
      }

      if (reminder.stop_condition === "time" && stopAt && nextRunAt > stopAt) {
        updates.status = "completed";
        updates.completed_at = nowIso;
      }

      await supabase.from("reminders").update(updates).eq("id", reminder.id);
    }
    processed.push(reminder.id);
  }

  return new Response(
    JSON.stringify({ processedCount: processed.length, processed }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});
