"use strict";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_PASSWORD = "toAdminPassword123#";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server configuration.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function extractPassword(request) {
  const headerPassword = request.headers.get("x-admin-password")?.trim();
  if (headerPassword) {
    return headerPassword;
  }
  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return authHeader || "";
}

function isAuthorized(request) {
  const password = extractPassword(request);
  return password === ADMIN_PASSWORD;
}

export async function POST(request, { params }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const reminderId = params?.id;
  if (!reminderId) {
    return NextResponse.json({ error: "Missing reminder id." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    return NextResponse.json(
      { error: "Supabase server configuration is missing." },
      { status: 500 }
    );
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("reminders")
    .update({ status: "completed", completed_at: nowIso })
    .eq("id", reminderId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("reminder_attempts").insert({
    reminder_id: reminderId,
    channel: "system",
    status: "stopped",
    error_message: null,
  });

  return NextResponse.json({ reminder: data });
}
