import { NextResponse } from "next/server";
import { createSupabaseAuthClient } from "../../../../../lib/supabaseAuth";
import { createSupabaseServerClient } from "../../../../../lib/supabaseServer";

export async function POST(request, { params }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Missing reminder id." }, { status: 400 });
  }

  const authClient = createSupabaseAuthClient();
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");

  const {
    data: { user },
  } = await authClient.auth.getUser();

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminder: data });
}
