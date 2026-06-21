import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildReminderEmail } from "../../../../lib/emailTemplate";
import { getSmsProvider } from "../../../../lib/smsProvider";
import { getWhatsAppProvider } from "../../../../lib/whatsappProvider";

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
  const whatsapp =
    typeof payload?.whatsapp === "string" ? payload.whatsapp.trim() : "";

  if (!email && !phone && !whatsapp) {
    return NextResponse.json(
      { error: "Provide a test email, phone number, or WhatsApp number." },
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
    const smsProvider = getSmsProvider();
    if (!smsProvider.isConfigured()) {
      results.sms = {
        status: "skipped",
        error: `Missing ${smsProvider.provider} SMS env vars.`,
      };
    } else {
      try {
        await smsProvider.send({
          to: phone,
          body: "Reminder Rocket test SMS",
        });
        results.sms = { status: "sent", provider: smsProvider.provider };
      } catch (error) {
        results.sms = {
          status: "failed",
          provider: smsProvider.provider,
          error: error instanceof Error ? error.message : "SMS failed.",
        };
      }
    }
  }

  if (whatsapp) {
    const whatsAppProvider = getWhatsAppProvider();
    if (!whatsAppProvider.isConfigured()) {
      results.whatsapp = {
        status: "skipped",
        error: whatsAppProvider.missingEnvHint,
      };
    } else {
      try {
        await whatsAppProvider.send({
          to: whatsapp,
          body: "Reminder Rocket test WhatsApp",
        });
        results.whatsapp = { status: "sent", provider: whatsAppProvider.provider };
      } catch (error) {
        results.whatsapp = {
          status: "failed",
          provider: whatsAppProvider.provider,
          error: error instanceof Error ? error.message : "WhatsApp failed.",
        };
      }
    }
  }

  return NextResponse.json({ results });
}
