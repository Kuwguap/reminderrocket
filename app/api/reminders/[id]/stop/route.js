import { NextResponse } from "next/server";
import { applyReminderOwnerFilter } from "../../../../../lib/reminderAccess";
import { createSupabaseAuthClient } from "../../../../../lib/supabaseAuth";
import { createSupabaseServerClient } from "../../../../../lib/supabaseServer";

async function resolveReminderId(request, params) {
  const resolved = await Promise.resolve(params);
  let id = resolved?.id;
  if (!id) {
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(/\/api\/reminders\/([^/]+)\/stop$/);
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
      console.warn("Reminders STOP auth init failed:", error);
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
    const now = new Date().toISOString();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    let user = null;
    if (authClient) {
      try {
        const {
          data: { user: authUser },
        } = await authClient.auth.getUser();
        user = authUser ?? null;
      } catch (error) {
        console.warn("Reminders STOP auth fetch failed:", error);
      }
    }

    if (!user && !clientId) {
      return NextResponse.json(
        { error: "Missing device session." },
        { status: 400 }
      );
    }

    let reminderQuery = supabase.from("reminders").select("*").eq("id", id);
    reminderQuery = applyReminderOwnerFilter(reminderQuery, user, clientId);

    const { data: reminder, error: fetchError } = await reminderQuery.single();

    if (fetchError) {
      console.error("Reminders STOP fetch error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (reminder.stop_condition === "proof" && !reminder.proof_url) {
      return NextResponse.json(
        { error: "Proof is required to stop this reminder." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("reminders")
      .update({ status: "completed", completed_at: now })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Reminders STOP update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reminder: data });
  } catch (error) {
    console.error("Reminders STOP failure:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
