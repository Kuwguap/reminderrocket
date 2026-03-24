import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildReminderEmail } from "../../../lib/emailTemplate";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";
import { formatZodErrors, reminderSchema } from "../../../lib/validation";

const FREQUENCY_INTERVALS_MS = {
  hourly: 60 * 60 * 1000,
  "every-3-hours": 3 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

function getIntervalMs(frequencyType, frequencyValue, frequencyUnit) {
  if (frequencyType !== "custom") {
    return FREQUENCY_INTERVALS_MS[frequencyType];
  }

  if (!frequencyValue || !frequencyUnit) {
    return null;
  }

  const multiplier = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  }[frequencyUnit];

  return multiplier ? frequencyValue * multiplier : null;
}

function getFrequencyLabel(reminder) {
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

function formatDateTime(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

async function sendConfirmationEmail(reminder) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !fromEmail || !reminder.email) {
    return { status: "skipped", reason: "Missing env vars or email." };
  }

  const resend = new Resend(resendApiKey);
  const html = buildReminderEmail({
    title: "Reminder scheduled",
    subtitle: "Your reminder is ready to launch.",
    message: reminder.message,
    details: [
      { label: "Recipient", value: reminder.recipient_name || "You" },
      { label: "Frequency", value: getFrequencyLabel(reminder) },
      { label: "Start time", value: formatDateTime(reminder.start_time) },
      {
        label: "Stop condition",
        value:
          reminder.stop_condition === "proof"
            ? "Picture proof required"
            : `Stop at ${formatDateTime(reminder.stop_at)}`,
      },
    ],
    ctaUrl: process.env.APP_BASE_URL || undefined,
    ctaLabel: "View reminders",
  });

  await resend.emails.send({
    from: fromEmail,
    to: reminder.email,
    subject: "Reminder Rocket confirmation",
    html,
  });

  return { status: "sent" };
}

export async function GET(request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("reminders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminders: data ?? [] });
}

export async function POST(request) {
  const supabase = createSupabaseServerClient();

  let payload = null;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const parsed = reminderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: formatZodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const startTime = new Date(data.start_time);
  const stopTime = data.stop_at ? new Date(data.stop_at) : null;

  if (Number.isNaN(startTime.getTime())) {
    return NextResponse.json(
      { errors: { start_time: "Invalid start time." } },
      { status: 400 }
    );
  }

  if (stopTime && stopTime <= startTime) {
    return NextResponse.json(
      { errors: { stop_at: "Stop time must be after start time." } },
      { status: 400 }
    );
  }

  const intervalMs = getIntervalMs(
    data.frequency_type,
    data.frequency_value,
    data.frequency_unit
  );

  if (!intervalMs) {
    return NextResponse.json(
      { errors: { frequency_value: "Invalid frequency selection." } },
      { status: 400 }
    );
  }

  const insertPayload = {
    message: data.message,
    recipient_name: data.recipient_name,
    phone: data.phone,
    email: data.email,
    frequency_type: data.frequency_type,
    frequency_value: data.frequency_type === "custom" ? data.frequency_value : null,
    frequency_unit: data.frequency_type === "custom" ? data.frequency_unit : null,
    start_time: startTime.toISOString(),
    next_run_at: startTime.toISOString(),
    stop_condition: data.stop_condition,
    stop_at: stopTime ? stopTime.toISOString() : null,
    status: "active",
  };

  const { data: reminder, error } = await supabase
    .from("reminders")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let confirmation = null;
  try {
    confirmation = await sendConfirmationEmail(reminder);
  } catch (error) {
    confirmation = { status: "failed", error: String(error) };
  }

  return NextResponse.json({ reminder, confirmation });
}
