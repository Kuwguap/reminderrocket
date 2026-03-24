import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  const envStatus = {
    supabaseUrl: hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceKey: hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    resendKey: hasValue(process.env.RESEND_API_KEY),
    resendFrom: hasValue(process.env.RESEND_FROM_EMAIL),
    twilioSid: hasValue(process.env.TWILIO_ACCOUNT_SID),
    twilioToken: hasValue(process.env.TWILIO_AUTH_TOKEN),
    twilioPhone: hasValue(process.env.TWILIO_PHONE_NUMBER),
    appBaseUrl: hasValue(process.env.APP_BASE_URL),
  };

  const summary = {
    supabase: false,
    resend: envStatus.resendKey && envStatus.resendFrom,
    twilio: envStatus.twilioSid && envStatus.twilioToken && envStatus.twilioPhone,
  };

  let supabaseError = null;
  if (envStatus.supabaseUrl && envStatus.supabaseServiceKey) {
    try {
      const supabase = createSupabaseServerClient();
      const { error } = await supabase.from("reminders").select("id").limit(1);
      if (error) {
        supabaseError = error.message;
      } else {
        summary.supabase = true;
      }
    } catch (error) {
      supabaseError = error instanceof Error ? error.message : "Supabase error.";
    }
  }

  return NextResponse.json({
    envStatus,
    summary,
    supabaseError,
  });
}
