import { createClient } from "@supabase/supabase-js";
import { createSupabaseAuthClient } from "./supabaseAuth";

/**
 * Cookie session (web) or Authorization: Bearer <access_token> (Telegram bot, etc.).
 */
export function getSupabaseAuthClientForRequest(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }

  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, "").trim()
      : "";

  if (bearer) {
    return createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
  }

  try {
    return createSupabaseAuthClient();
  } catch {
    return null;
  }
}
