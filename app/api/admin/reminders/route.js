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

function isAuthorized(request) {
  const password = request.headers.get("x-admin-password")?.trim();
  return password === ADMIN_PASSWORD;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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

  const { data, error } = await supabase
    .from("reminders")
    .select(
      [
        "id",
        "created_at",
        "recipient_name",
        "message",
        "phone",
        "email",
        "frequency_type",
        "frequency_value",
        "frequency_unit",
        "next_run_at",
        "stop_condition",
        "stop_at",
        "status",
      ].join(",")
    )
    .eq("status", "active")
    .order("next_run_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminders: data ?? [] });
}
