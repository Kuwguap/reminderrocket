import { serve } from "https://deno.land/std@0.214.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL");
const KLAVIYO_API_KEY = Deno.env.get("KLAVIYO_API_KEY");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "";

const requiredEnv = [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
].filter(([, value]) => !value);

const hasResend =
  Boolean(RESEND_API_KEY) && Boolean(RESEND_FROM_EMAIL);
const hasKlaviyo = Boolean(KLAVIYO_API_KEY);

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

async function sendKlaviyoSmsEvent(params: {
  phoneNumber: string;
  email?: string | null;
  externalId?: string | null;
  message: string;
  reminderId: string;
  frequencyLabel: string;
  stopCondition: string;
  manageUrl?: string | null;
  uploadUrl?: string | null;
  nextRunAt?: string | null;
  nextRunAtLabel?: string | null;
}) {
  const profileAttributes: Record<string, string> = {
    phone_number: params.phoneNumber,
  };
  if (params.email) {
    profileAttributes.email = params.email;
  }
  if (params.externalId) {
    profileAttributes.external_id = params.externalId;
  }

  const payload = {
    data: {
      type: "event",
      attributes: {
        properties: {
          message: params.message,
          reminder_id: params.reminderId,
          frequency: params.frequencyLabel,
          stop_condition: params.stopCondition,
          manage_url: params.manageUrl ?? null,
          upload_url: params.uploadUrl ?? null,
          next_run_at: params.nextRunAt ?? null,
          next_run_at_label: params.nextRunAtLabel ?? null,
        },
        metric: {
          data: {
            type: "metric",
            attributes: {
              name: "Reminder Rocket SMS",
            },
          },
        },
        profile: {
          data: {
            type: "profile",
            attributes: profileAttributes,
          },
        },
      },
    },
  };

  const response = await fetch("https://a.klaviyo.com/api/events/", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
      accept: "application/vnd.api+json",
      "content-type": "application/vnd.api+json",
      revision: "2026-01-15",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Klaviyo SMS event failed.");
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
  subtitle: string;
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
      ${
        params.secondaryCtaUrl
          ? `<a href="${escapeHtml(
              params.secondaryCtaUrl
            )}" style="display: inline-block; margin-top: 8px; margin-left: 8px; border: 1px solid #fb923c; color: #f97316; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 999px;">${escapeHtml(
              params.secondaryCtaLabel ?? "Upload receipt"
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

    const intervalMs = getIntervalMs(reminder);
    if (!intervalMs) {
      await logAttempt(reminder.id, "system", "failed", "Invalid frequency.");
      continue;
    }

    const uploadUrl =
      reminder.stop_condition === "proof" ? buildUploadUrl(reminder) : null;
    const messageBody = `${reminder.message}\n\nManage: ${
      APP_BASE_URL || "your Reminder Rocket dashboard"
    }${uploadUrl ? `\nUpload receipt: ${uploadUrl}` : ""}`;

    if (reminder.phone) {
      try {
        if (!hasKlaviyo) {
          await logAttempt(
            reminder.id,
            "sms",
            "skipped",
            "Missing Klaviyo API key."
          );
        } else {
          hasConfiguredChannel = true;
          await sendKlaviyoSmsEvent({
            phoneNumber: reminder.phone,
            email: reminder.email,
            externalId: reminder.client_id || reminder.user_id || reminder.id,
            message: messageBody,
            reminderId: reminder.id,
            frequencyLabel: getFrequencyLabel(reminder),
            stopCondition:
              reminder.stop_condition === "proof"
                ? "Picture proof required"
                : `Stop at ${formatDateTime(reminder.stop_at)}`,
            manageUrl: APP_BASE_URL || null,
            uploadUrl,
            nextRunAt: reminder.next_run_at,
            nextRunAtLabel: formatDateTime(reminder.next_run_at),
          });
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
