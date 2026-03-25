import { serve } from "https://deno.land/std@0.214.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "";

const requiredEnv = [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
].filter(([, value]) => !value);

const hasResend =
  Boolean(RESEND_API_KEY) && Boolean(RESEND_FROM_EMAIL);
const hasTwilio =
  Boolean(TWILIO_ACCOUNT_SID) &&
  Boolean(TWILIO_AUTH_TOKEN) &&
  Boolean(TWILIO_PHONE_NUMBER);

const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_SERVICE_ROLE_KEY ?? "");

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

async function logAttempt(reminderId: string, channel: string, status: string, error?: string) {
  await supabase.from("reminder_attempts").insert({
    reminder_id: reminderId,
    channel,
    status,
    error_message: error ?? null,
  });
}

async function sendSms(to: string, body: string) {
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: TWILIO_PHONE_NUMBER ?? "",
        Body: body,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Twilio send failed.");
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

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

function getFrequencyLabel(reminder: {
  frequency_type: string;
  frequency_value?: number | null;
  frequency_unit?: string | null;
}) {
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

function buildReminderEmail(params: {
  title: string;
  subtitle: string;
  message: string;
  details: Array<{ label: string; value: string }>;
  ctaUrl?: string;
  ctaLabel?: string;
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

  return `
  <div style="background-color: #ffffff; padding: 24px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a;">
    <div style="max-width: 560px; margin: 0 auto; border: 1px solid #fed7aa; border-radius: 24px; padding: 24px;">
      <div style="display: inline-block; border: 1px solid #fb923c; color: #f97316; border-radius: 999px; padding: 4px 12px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-weight: 700;">
        Reminder Rocket
      </div>
      <h1 style="margin: 16px 0 8px; font-size: 22px;">${escapeHtml(
        params.title
      )}</h1>
      <p style="margin: 0 0 16px; color: #475569; font-size: 14px;">${escapeHtml(
        params.subtitle
      )}</p>
      <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 18px; padding: 16px;">
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #0f172a;">
          ${formatMultiline(params.message)}
        </p>
      </div>
      <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
        ${detailRows}
      </table>
      ${
        params.ctaUrl
          ? `<a href="${escapeHtml(
              params.ctaUrl
            )}" style="display: inline-block; margin-top: 8px; background-color: #f97316; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 999px;">${escapeHtml(
              params.ctaLabel ?? "Open Reminder Rocket"
            )}</a>`
          : ""
      }
      <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
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
    const stopAt = reminder.stop_at ? new Date(reminder.stop_at) : null;
    if (reminder.stop_condition === "time" && stopAt && stopAt <= now) {
      await supabase
        .from("reminders")
        .update({ status: "completed", completed_at: nowIso })
        .eq("id", reminder.id);
      continue;
    }

    const intervalMs = getIntervalMs(reminder);
    if (!intervalMs) {
      await logAttempt(reminder.id, "system", "failed", "Invalid frequency.");
      continue;
    }

    const messageBody = `${reminder.message}\n\nManage: ${
      APP_BASE_URL || "your Reminder Rocket dashboard"
    }`;

    if (reminder.phone) {
      try {
        if (!hasTwilio) {
          await logAttempt(
            reminder.id,
            "sms",
            "skipped",
            "Missing Twilio env vars."
          );
        } else {
          await sendSms(reminder.phone, messageBody);
          await logAttempt(reminder.id, "sms", "sent");
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
          const html = buildReminderEmail({
            title: "Reminder alert",
            subtitle: "Your reminder is active.",
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
            ctaLabel: "Open Reminder Rocket",
          });
          await sendEmail(reminder.email, "Reminder Rocket", html);
          await logAttempt(reminder.id, "email", "sent");
        }
      } catch (error) {
        await logAttempt(reminder.id, "email", "failed", String(error));
      }
    }

    const nextRunAt = new Date(now.getTime() + intervalMs);
    const updates: Record<string, string> = {
      last_sent_at: nowIso,
      next_run_at: nextRunAt.toISOString(),
    };

    if (reminder.stop_condition === "time" && stopAt && nextRunAt > stopAt) {
      updates.status = "completed";
      updates.completed_at = nowIso;
    }

    await supabase.from("reminders").update(updates).eq("id", reminder.id);
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
