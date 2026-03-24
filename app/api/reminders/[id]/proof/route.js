import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { createSupabaseServerClient } from "../../../../../lib/supabaseServer";

export async function POST(request, { params }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Missing reminder id." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Proof file is required." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: reminder, error: fetchError } = await supabase
    .from("reminders")
    .select("id, stop_condition, status")
    .eq("id", id)
    .single();

  if (fetchError) {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminder: data, proofPath: filePath });
}
