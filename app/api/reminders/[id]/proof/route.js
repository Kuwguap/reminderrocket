import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { Resend } from "resend";
import { buildReminderEmail } from "../../../../../lib/emailTemplate";
import { applyReminderOwnerFilter } from "../../../../../lib/reminderAccess";
import { getServerAuthUser } from "../../../../../lib/serverAuthUser";
import { createSupabaseAuthClient } from "../../../../../lib/supabaseAuth";
import { createSupabaseServerClient } from "../../../../../lib/supabaseServer";

function formatNy(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
}

async function sendMissionCompleteEmail(reminder, proofSignedUrl) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey || !fromEmail || !reminder.email) {
    return { status: "skipped" };
  }
  try {
    const resend = new Resend(resendApiKey);
    const html = buildReminderEmail({
      title: "Mission complete",
      subtitle:
        "Your receipt proof is uploaded. Use the link below to view what you sent — and make sure you truly completed the mission.",
      message: reminder.message,
      details: [
        { label: "Completed at (ET)", value: formatNy(reminder.completed_at) },
        {
          label: "Proof",
          value: proofSignedUrl
            ? "“View your proof” below (link expires in 7 days)."
            : "Stored securely in your reminder.",
        },
      ],
      ctaUrl: process.env.APP_BASE_URL || undefined,
      ctaLabel: "Open Reminder Rocket",
      secondaryCtaUrl: proofSignedUrl || undefined,
      secondaryCtaLabel: "View your proof",
    });
    await resend.emails.send({
      from: fromEmail,
      to: reminder.email,
      subject: "Reminder Rocket — mission complete",
      html,
    });
    return { status: "sent" };
  } catch (error) {
    console.error("Mission complete email failed:", error);
    return { status: "failed", error: String(error) };
  }
}

async function resolveReminderId(request, params) {
  const resolved = await Promise.resolve(params);
  let id = resolved?.id;
  if (!id) {
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(/\/api\/reminders\/([^/]+)\/proof$/);
    id = match?.[1] ?? null;
  }
  return id;
}

export async function POST(request, { params }) {
  try {
    const id = await resolveReminderId(request, params);

    if (!id) {
      return NextResponse.json(
        { error: "Missing reminder id." },
        { status: 400 }
      );
    }

    let authClient = null;
    try {
      authClient = createSupabaseAuthClient();
    } catch (error) {
      console.warn("Reminders PROOF auth init failed:", error);
    }
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
    const clientId = searchParams.get("client_id");

    const user = authClient ? await getServerAuthUser(authClient) : null;

    if (!user && !clientId) {
      return NextResponse.json(
        { error: "Missing device session." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Proof file is required." },
        { status: 400 }
      );
    }

    let reminderQuery = supabase
      .from("reminders")
      .select("id, stop_condition, status")
      .eq("id", id);

    reminderQuery = applyReminderOwnerFilter(reminderQuery, user, clientId);

    const { data: reminder, error: fetchError } = await reminderQuery.single();

    if (fetchError) {
      console.error("Reminders PROOF fetch error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (reminder.stop_condition !== "proof") {
      return NextResponse.json(
        { error: "Proof uploads are only required for proof-based reminders." },
        { status: 400 }
      );
    }

    if (reminder.status !== "active") {
      return NextResponse.json(
        { error: "Reminder is no longer active." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = file.name?.replace(/\s+/g, "-") || "proof.jpg";
    const filePath = `reminder-proofs/${id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("reminder-proofs")
      .upload(filePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Reminders PROOF upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("reminders")
      .update({ proof_url: filePath, status: "completed", completed_at: now })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Reminders PROOF update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let proofSignedUrl = null;
    const { data: signed, error: signError } = await supabase.storage
      .from("reminder-proofs")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);
    if (!signError && signed?.signedUrl) {
      proofSignedUrl = signed.signedUrl;
    }

    let completionEmail = null;
    try {
      completionEmail = await sendMissionCompleteEmail(data, proofSignedUrl);
    } catch (emailError) {
      completionEmail = { status: "failed", error: String(emailError) };
    }

    return NextResponse.json({
      reminder: data,
      proofPath: filePath,
      completionEmail,
    });
  } catch (error) {
    console.error("Reminders PROOF failure:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
