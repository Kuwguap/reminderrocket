import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildReminderEmail } from "../../../../lib/emailTemplate";
import { isVonageConfigured, sendVonageSms } from "../../../../lib/vonageSms";

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request) {
  let payload = null;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  const phone = typeof payload?.phone === "string" ? payload.phone.trim() : "";

  if (!email && !phone) {
    return NextResponse.json(
      { error: "Provide a test email or phone number." },
      { status: 400 }
    );
  }

  const results = {};

  if (email) {
    if (
      !hasValue(process.env.RESEND_API_KEY) ||
      !hasValue(process.env.RESEND_FROM_EMAIL)
    ) {
      results.email = { status: "skipped", error: "Missing Resend env vars." };
    } else {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = buildReminderEmail({
          title: "Reminder Rocket test email",
          subtitle: "This message confirms your email delivery is set.",
          message: "If you can read this, Resend is configured correctly.",
          details: [
            { label: "Recipient", value: email },
            { label: "Status", value: "Email test sent" },
          ],
          ctaUrl: process.env.APP_BASE_URL || undefined,
          ctaLabel: "Open Reminder Rocket",
        });
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: email,
          subject: "Reminder Rocket test email",
          html,
        });
        results.email = { status: "sent" };
      } catch (error) {
        results.email = {
          status: "failed",
          error: error instanceof Error ? error.message : "Email failed.",
        };
      }
    }
  }

  if (phone) {
    if (!isVonageConfigured()) {
      results.sms = { status: "skipped", error: "Missing Vonage env vars." };
    } else {
      try {
        await sendVonageSms({
          to: phone,
          body: "Reminder Rocket test SMS",
        });
        results.sms = { status: "sent" };
      } catch (error) {
        results.sms = {
          status: "failed",
          error: error instanceof Error ? error.message : "SMS failed.",
        };
      }
    }
  }

  return NextResponse.json({ results });
}
