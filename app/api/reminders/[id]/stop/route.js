import { NextResponse } from "next/server";
import { createSupabaseAuthClient } from "../../../../../lib/supabaseAuth";
import { createSupabaseServerClient } from "../../../../../lib/supabaseServer";

export async function POST(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing reminder id." },
        { status: 400 }
      );
    }

    const authClient = createSupabaseAuthClient();
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
      const {
        data: { user: authUser },
      } = await authClient.auth.getUser();
      user = authUser ?? null;
    }

    if (!user && !clientId) {
      return NextResponse.json(
        { error: "Missing device session." },
        { status: 400 }
      );
    }

    let reminderQuery = supabase.from("reminders").select("*").eq("id", id);
    if (user) {
      reminderQuery = reminderQuery.eq("user_id", user.id);
    } else {
      reminderQuery = reminderQuery.eq("client_id", clientId);
    }

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
