import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabaseServer";

export async function POST(request, { params }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Missing reminder id." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data: reminder, error: fetchError } = await supabase
    .from("reminders")
    .select("*")
    .eq("id", id)
    .single();

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
