import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";
import { hasValidBotSecret } from "../../../../lib/botAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal endpoint used by the long-running Telegram bot service to discover
 * which active proof-based reminders belong to a given Telegram chat. Auth is a
 * shared bot secret; identity is asserted via telegram_chat_id query param.
 */
export async function GET(request) {
  if (!hasValidBotSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("telegram_chat_id");
  const chatId = raw ? Number(raw) : NaN;
  if (!Number.isFinite(chatId)) {
    return NextResponse.json(
      { error: "telegram_chat_id query param is required." },
      { status: 400 }
    );
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

  const { data, error } = await supabase
    .from("reminders")
    .select("id, message, stop_condition, status, created_at")
    .eq("telegram_chat_id", chatId)
    .eq("stop_condition", "proof")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Telegram proof-targets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminders: data ?? [] });
}
