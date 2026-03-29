"use strict";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { buildReminderEmail } from "../../../../lib/emailTemplate";
import { sendSmsEvent } from "../../../../lib/klaviyo";
import { formatDateTimeNy } from "../../../../lib/nyTime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getIntervalMs(reminder) {
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

function getFrequencyLabel(reminder) {
  if (reminder.frequency_type === "annoy") {
    return "Annoy me until done";
  }
  if (reminder.frequency_type === "custom") {
    return `Every ${reminder.frequency_value} ${reminder.frequency_unit}`;
  }
  const labels = {
    hourly: "Every hour",
    "every-3-hours": "Every 3 hours",
    daily: "Daily",
  };
  return labels[reminder.frequency_type] ?? reminder.frequency_type;
}

function buildUploadUrl(reminder, appBaseUrl) {
  if (!appBaseUrl) {
    return null;
  }
  const base = appBaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/upload/${reminder.id}`);
  if (reminder.client_id) {
    url.searchParams.set("client_id", reminder.client_id);
  }
  return url.toString();
}

async function getAnnoyMeta(reminderId, channel, supabase) {
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

export async function GET(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server configuration." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const hasResend =
    Boolean(process.env.RESEND_API_KEY) &&
    Boolean(process.env.RESEND_FROM_EMAIL);
  const hasKlaviyo = Boolean(process.env.KLAVIYO_API_KEY);
  const appBaseUrl = process.env.APP_BASE_URL || "";

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: dueReminders, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", nowIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const processed = [];

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

    const annoyMeta =
      reminder.frequency_type === "annoy"
        ? await getAnnoyMeta(
            reminder.id,
            reminder.phone ? "sms" : "email",
            supabase
          )
        : null;
    const intervalMs =
      reminder.frequency_type === "annoy"
        ? annoyMeta?.intervalMs
        : getIntervalMs(reminder);
    if (!intervalMs) {
      await supabase.from("reminder_attempts").insert({
        reminder_id: reminder.id,
        channel: "system",
        status: "failed",
        error_message: "Invalid frequency.",
      });
      continue;
    }

    const uploadUrl = buildUploadUrl(reminder, appBaseUrl);
    const smsMessage = annoyMeta?.tone
      ? `${annoyMeta.tone}\n${reminder.message}`
      : reminder.message;

    if (reminder.phone) {
      try {
        if (!hasKlaviyo) {
          await supabase.from("reminder_attempts").insert({
            reminder_id: reminder.id,
            channel: "sms",
            status: "skipped",
            error_message: "Missing Klaviyo API key.",
          });
        } else {
          hasConfiguredChannel = true;
          await sendSmsEvent({
            apiKey: process.env.KLAVIYO_API_KEY,
            phoneNumber: reminder.phone,
            email: reminder.email,
            externalId: reminder.client_id || reminder.user_id || reminder.id,
            message: smsMessage,
            reminderId: reminder.id,
            frequencyLabel: getFrequencyLabel(reminder),
            stopCondition:
              reminder.stop_condition === "proof"
                ? "Picture proof required"
                : `Stop at ${formatDateTimeNy(reminder.stop_at)}`,
            manageUrl: appBaseUrl || null,
            uploadUrl,
            nextRunAt: reminder.next_run_at,
            nextRunAtLabel: formatDateTimeNy(reminder.next_run_at),
            tone: annoyMeta?.tone ?? null,
          });
          await supabase.from("reminder_attempts").insert({
            reminder_id: reminder.id,
            channel: "sms",
            status: "sent",
          });
          delivered = true;
        }
      } catch (error) {
        await supabase.from("reminder_attempts").insert({
          reminder_id: reminder.id,
          channel: "sms",
          status: "failed",
          error_message: String(error),
        });
      }
    }

    if (reminder.email) {
      try {
        if (!hasResend) {
          await supabase.from("reminder_attempts").insert({
            reminder_id: reminder.id,
            channel: "email",
            status: "skipped",
            error_message: "Missing Resend env vars.",
          });
        } else {
          hasConfiguredChannel = true;
          const resend = new Resend(process.env.RESEND_API_KEY);
          const html = buildReminderEmail({
            title: "Reminder alert",
            subtitle: null,
            message: reminder.message,
            details: [
              { label: "Recipient", value: reminder.recipient_name || "You" },
              { label: "Frequency", value: getFrequencyLabel(reminder) },
              { label: "Next run", value: formatDateTimeNy(reminder.next_run_at) },
              {
                label: "Stop condition",
                value:
                  reminder.stop_condition === "proof"
                    ? "Picture proof required"
                    : `Stop at ${formatDateTimeNy(reminder.stop_at)}`,
              },
            ],
            ctaUrl: appBaseUrl || undefined,
            ctaLabel: "Complete the mission",
            secondaryCtaUrl:
              reminder.stop_condition === "proof" ? uploadUrl : undefined,
            secondaryCtaLabel: "Upload receipt",
          });
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: reminder.email,
            subject: "Reminder Rocket",
            html,
          });
          await supabase.from("reminder_attempts").insert({
            reminder_id: reminder.id,
            channel: "email",
            status: "sent",
          });
          delivered = true;
        }
      } catch (error) {
        await supabase.from("reminder_attempts").insert({
          reminder_id: reminder.id,
          channel: "email",
          status: "failed",
          error_message: String(error),
        });
      }
    }

    const shouldAdvance = delivered || !hasConfiguredChannel;
    if (shouldAdvance) {
      const nextRunAt = new Date(now.getTime() + intervalMs);
      const updates = { next_run_at: nextRunAt.toISOString() };
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

  return NextResponse.json({
    processedCount: processed.length,
    processed,
  });
}
