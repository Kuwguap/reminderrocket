import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildReminderEmail } from "../../../../lib/emailTemplate";
import { sendSmsEvent, subscribeSmsProfile } from "../../../../lib/klaviyo";

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
    if (!hasValue(process.env.RESEND_API_KEY) || !hasValue(process.env.RESEND_FROM_EMAIL)) {
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

  if (phone || email) {
    if (!hasValue(process.env.KLAVIYO_API_KEY)) {
      results.sms = { status: "skipped", error: "Missing Klaviyo API key." };
    } else {
      try {
        const externalId = phone
          ? `rr_test_${phone.replace(/\D/g, "")}`
          : `rr_test_${email.replace(/[^a-z0-9]/gi, "").slice(0, 48)}`;

        if (phone) {
          await subscribeSmsProfile({
            apiKey: process.env.KLAVIYO_API_KEY,
            email: email || null,
            phoneNumber: phone,
            listId: process.env.KLAVIYO_LIST_ID || null,
          });
        }

        await sendSmsEvent({
          apiKey: process.env.KLAVIYO_API_KEY,
          phoneNumber: phone || null,
          email: email || null,
          externalId,
          message: "Reminder Rocket test SMS",
          reminderId: externalId,
          frequencyLabel: "Test",
          stopCondition: "Test",
          manageUrl: process.env.APP_BASE_URL || null,
          uploadUrl: null,
          nextRunAt: new Date().toISOString(),
          nextRunAtLabel: new Date().toLocaleString(),
          tone: null,
        });

        results.sms = phone
          ? {
              status: "queued",
              note:
                "Klaviyo will send SMS when a flow is configured for the Reminder Rocket SMS event.",
            }
          : {
              status: "seeded",
              note:
                "Klaviyo event sent to create the Reminder Rocket SMS metric.",
            };
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
