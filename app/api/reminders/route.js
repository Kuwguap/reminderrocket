import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildReminderEmail } from "../../../lib/emailTemplate";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";
import { getSmsProvider } from "../../../lib/smsProvider";
import { getWhatsAppProvider } from "../../../lib/whatsappProvider";
import { getSupabaseAuthClientForRequest } from "../../../lib/supabaseRouteAuth";
import { applyReminderListFilter } from "../../../lib/reminderAccess";
import { getServerAuthUser } from "../../../lib/serverAuthUser";
import { formatDateTimeNy } from "../../../lib/nyTime";
import { formatZodErrors, reminderSchema } from "../../../lib/validation";
import {
  uploadReminderMedia,
  validateReminderMediaFile,
} from "../../../lib/reminderMedia";

const FREQUENCY_INTERVALS_MS = {
  hourly: 60 * 60 * 1000,
  "every-3-hours": 3 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

function getIntervalMs(frequencyType, frequencyValue, frequencyUnit) {
  if (frequencyType !== "custom") {
    if (frequencyType === "annoy") {
      return 15 * 60 * 1000;
    }
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

function buildUploadUrl(reminder) {
  if (!process.env.APP_BASE_URL) {
    return null;
  }
  const base = process.env.APP_BASE_URL.replace(/\/+$/, "");
  const url = new URL(`${base}/upload/${reminder.id}`);
  if (reminder.client_id) {
    url.searchParams.set("client_id", reminder.client_id);
  }
  return url.toString();
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
    subtitle: null,
    message: reminder.message,
    details: [
      { label: "Recipient", value: reminder.recipient_name || "You" },
      { label: "Frequency", value: getFrequencyLabel(reminder) },
      { label: "First reminder", value: formatDateTimeNy(reminder.next_run_at) },
      {
        label: "Stop condition",
        value:
          reminder.stop_condition === "proof"
            ? "Picture proof required"
            : `Stop at ${formatDateTimeNy(reminder.stop_at)}`,
      },
    ],
    ctaUrl: process.env.APP_BASE_URL || undefined,
    ctaLabel: "Complete the mission",
    secondaryCtaUrl:
      reminder.stop_condition === "proof" ? buildUploadUrl(reminder) : undefined,
    secondaryCtaLabel: "Upload receipt",
  });

  await resend.emails.send({
    from: fromEmail,
    to: reminder.email,
    subject: "Reminder Rocket confirmation",
    html,
  });

  return { status: "sent" };
}

function emptyField(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseReminderPayload(raw) {
  return {
    client_id: emptyField(raw.client_id),
    message: emptyField(raw.message),
    image_path: emptyField(raw.image_path),
    voice_path: emptyField(raw.voice_path),
    recipient_name: emptyField(raw.recipient_name),
    phone: emptyField(raw.phone),
    whatsapp: emptyField(raw.whatsapp),
    email: emptyField(raw.email),
    frequency_type: raw.frequency_type,
    frequency_value:
      raw.frequency_value === "" || raw.frequency_value == null
        ? null
        : Number(raw.frequency_value),
    frequency_unit: emptyField(raw.frequency_unit),
    start_time: raw.start_time,
    stop_condition: raw.stop_condition,
    stop_at: emptyField(raw.stop_at),
    telegram_chat_id:
      raw.telegram_chat_id === "" || raw.telegram_chat_id == null
        ? null
        : Number(raw.telegram_chat_id),
  };
}

async function parseReminderRequest(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload = parseReminderPayload({
      client_id: formData.get("client_id"),
      message: formData.get("message"),
      recipient_name: formData.get("recipient_name"),
      phone: formData.get("phone"),
      whatsapp: formData.get("whatsapp"),
      email: formData.get("email"),
      frequency_type: formData.get("frequency_type"),
      frequency_value: formData.get("frequency_value"),
      frequency_unit: formData.get("frequency_unit"),
      start_time: formData.get("start_time"),
      stop_condition: formData.get("stop_condition"),
      stop_at: formData.get("stop_at"),
      telegram_chat_id: formData.get("telegram_chat_id"),
    });
    const imageFile = formData.get("image");
    const voiceFile = formData.get("voice");
    return {
      payload,
      imageFile:
        imageFile && typeof imageFile !== "string" ? imageFile : null,
      voiceFile:
        voiceFile && typeof voiceFile !== "string" ? voiceFile : null,
    };
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch (error) {
    throw new Error("Invalid JSON payload.");
  }
  return { payload: parseReminderPayload(payload), imageFile: null, voiceFile: null };
}

async function attachReminderMedia(supabase, reminder, { imageFile, voiceFile }) {
  let imagePath = null;
  let voicePath = null;
  const mediaErrors = {};

  if (imageFile) {
    const imageValidation = validateReminderMediaFile(imageFile, "image");
    if (imageValidation) {
      mediaErrors.image = imageValidation;
    } else {
      imagePath = await uploadReminderMedia(supabase, {
        reminderId: reminder.id,
        file: imageFile,
        kind: "image",
        filename: imageFile.name,
      });
    }
  }

  if (voiceFile) {
    const voiceValidation = validateReminderMediaFile(voiceFile, "voice");
    if (voiceValidation) {
      mediaErrors.voice = voiceValidation;
    } else {
      voicePath = await uploadReminderMedia(supabase, {
        reminderId: reminder.id,
        file: voiceFile,
        kind: "voice",
        filename: voiceFile.name || "voice-note.webm",
      });
    }
  }

  if (Object.keys(mediaErrors).length > 0) {
    await supabase.from("reminders").delete().eq("id", reminder.id);
    return { errors: mediaErrors };
  }

  if (!imagePath && !voicePath) {
    return { reminder };
  }

  const { data, error } = await supabase
    .from("reminders")
    .update({
      image_path: imagePath,
      voice_path: voicePath,
    })
    .eq("id", reminder.id)
    .select("*")
    .single();

  if (error) {
    await supabase.from("reminders").delete().eq("id", reminder.id);
    throw new Error(error.message);
  }

  return { reminder: data };
}

export async function GET(request) {
  try {
    const authClient = getSupabaseAuthClientForRequest(request);
    let supabase;
    try {
      supabase = createSupabaseServerClient();
    } catch (error) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("client_id");

    const user =
      authClient != null ? await getServerAuthUser(authClient) : null;

    let query = supabase
      .from("reminders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (status) {
      query = query.eq("status", status);
    }

    if (user || clientId) {
      query = applyReminderListFilter(query, user, clientId);
    } else {
      return NextResponse.json({ reminders: [] });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Reminders GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reminders: data ?? [] });
  } catch (error) {
    console.error("Reminders GET failure:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authClient = getSupabaseAuthClientForRequest(request);
    let supabase;
    try {
      supabase = createSupabaseServerClient();
    } catch (error) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    let payload = null;
    let imageFile = null;
    let voiceFile = null;
    try {
      const parsedRequest = await parseReminderRequest(request);
      payload = parsedRequest.payload;
      imageFile = parsedRequest.imageFile;
      voiceFile = parsedRequest.voiceFile;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid payload." },
        { status: 400 }
      );
    }

    const validationPayload = { ...payload };
    if (imageFile) {
      validationPayload.image_path = "pending";
    }
    if (voiceFile) {
      validationPayload.voice_path = "pending";
    }

    const parsed = reminderSchema.safeParse(validationPayload);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const user =
      authClient != null ? await getServerAuthUser(authClient) : null;

    const clientId = data.client_id;
    if (!user && !clientId) {
      return NextResponse.json(
        { errors: { client_id: "Missing device session." } },
        { status: 400 }
      );
    }

    const now = new Date();
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

    if (data.phone) {
      const smsProvider = getSmsProvider();
      if (!smsProvider.isConfigured()) {
        return NextResponse.json(
          {
            errors: { phone: smsProvider.missingEnvHint },
          },
          { status: 400 }
        );
      }
    }

    if (data.whatsapp) {
      const whatsAppProvider = getWhatsAppProvider();
      if (!whatsAppProvider.isConfigured()) {
        return NextResponse.json(
          {
            errors: { whatsapp: whatsAppProvider.missingEnvHint },
          },
          { status: 400 }
        );
      }
    }

    // When start_time is now (or earlier), fire on the next cron tick instead of waiting a full interval.
    // Scheduled future starts continue to wait until that exact time.
    const nextRunAt = startTime <= now ? now : startTime;

    const insertPayload = {
      message: data.message,
      recipient_name: data.recipient_name,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      frequency_type: data.frequency_type,
      frequency_value:
        data.frequency_type === "custom" ? data.frequency_value : null,
      frequency_unit:
        data.frequency_type === "custom" ? data.frequency_unit : null,
      start_time: startTime.toISOString(),
      next_run_at: nextRunAt.toISOString(),
      stop_condition: data.stop_condition,
      stop_at: stopTime ? stopTime.toISOString() : null,
      user_id: user ? user.id : null,
      client_id: clientId || null,
      status: "active",
    };

    if (data.telegram_chat_id != null) {
      insertPayload.telegram_chat_id = data.telegram_chat_id;
    }

    let reminder = null;
    let error = null;
    {
      const attempt = await supabase
        .from("reminders")
        .insert(insertPayload)
        .select("*")
        .single();
      reminder = attempt.data ?? null;
      error = attempt.error ?? null;
    }

    // If the database hasn't been migrated yet, Telegram must stay optional.
    // Supabase may return a schema-cache error like:
    // "Could not find the 'telegram_chat_id' column of 'reminders' in the schema cache"
    if (
      error &&
      String(error.message || "")
        .toLowerCase()
        .includes("telegram_chat_id") &&
      String(error.message || "")
        .toLowerCase()
        .includes("schema cache")
    ) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.telegram_chat_id;
      const fallback = await supabase
        .from("reminders")
        .insert(fallbackPayload)
        .select("*")
        .single();
      reminder = fallback.data ?? null;
      error = fallback.error ?? null;
    }

    if (error) {
      console.error("Reminders POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (imageFile || voiceFile) {
      try {
        const mediaResult = await attachReminderMedia(supabase, reminder, {
          imageFile,
          voiceFile,
        });
        if (mediaResult.errors) {
          return NextResponse.json(
            { errors: mediaResult.errors },
            { status: 400 }
          );
        }
        reminder = mediaResult.reminder;
      } catch (mediaError) {
        console.error("Reminders media upload error:", mediaError);
        return NextResponse.json(
          {
            error:
              mediaError instanceof Error
                ? mediaError.message
                : "Unable to upload reminder media.",
          },
          { status: 500 }
        );
      }
    }

    let confirmation = null;
    try {
      confirmation = await sendConfirmationEmail(reminder);
    } catch (error) {
      confirmation = { status: "failed", error: String(error) };
    }

    return NextResponse.json({ reminder, confirmation });
  } catch (error) {
    console.error("Reminders POST failure:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
