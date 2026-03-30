import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";
import { getSupabaseAuthClientForRequest } from "../../../../lib/supabaseRouteAuth";
import { getServerAuthUser } from "../../../../lib/serverAuthUser";

export async function POST(request) {
  try {
    const authClient = getSupabaseAuthClientForRequest(request);
    const user = authClient != null ? await getServerAuthUser(authClient) : null;
    if (!user) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    if (!clientId) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    // Only claim rows the requester already has access to (client_id match),
    // and that are not yet tied to a user_id.
    const selectQuery = supabase
      .from("reminders")
      .select("id, user_id, client_id")
      .eq("client_id", clientId)
      .is("user_id", null)
      .limit(200);

    const { data: rows, error: selectError } = await selectQuery;
    if (selectError) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const ids = (rows ?? []).map((r) => r.id).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const { error: updateError } = await supabase
      .from("reminders")
      .update({ user_id: user.id })
      .in("id", ids);

    if (updateError) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (error) {
    return NextResponse.json({ ok: true, updated: 0 });
  }
}

