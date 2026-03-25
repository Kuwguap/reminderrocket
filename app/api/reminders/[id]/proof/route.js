import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Proof file is required." },
        { status: 400 }
      );
    }

    let reminderQuery = supabase
      .from("reminders")
      .select("id, stop_condition, status")
      .eq("id", id);

    if (user) {
      reminderQuery = reminderQuery.eq("user_id", user.id);
    } else {
      reminderQuery = reminderQuery.eq("client_id", clientId);
    }

    const { data: reminder, error: fetchError } = await reminderQuery.single();

    if (fetchError) {
      console.error("Reminders PROOF fetch error:", fetchError);
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
      console.error("Reminders PROOF upload error:", uploadError);
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
      console.error("Reminders PROOF update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reminder: data, proofPath: filePath });
  } catch (error) {
    console.error("Reminders PROOF failure:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
