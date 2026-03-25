import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  const envStatus = {
    supabaseUrl: hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceKey: hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    resendKey: hasValue(process.env.RESEND_API_KEY),
    resendFrom: hasValue(process.env.RESEND_FROM_EMAIL),
    klaviyoKey: hasValue(process.env.KLAVIYO_API_KEY),
    klaviyoList: hasValue(process.env.KLAVIYO_LIST_ID),
    appBaseUrl: hasValue(process.env.APP_BASE_URL),
  };

  const summary = {
    supabase: false,
    resend: envStatus.resendKey && envStatus.resendFrom,
    klaviyo: envStatus.klaviyoKey,
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
