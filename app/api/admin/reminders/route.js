"use strict";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function extractPassword(request) {
  const headerPassword = request.headers.get("x-admin-password")?.trim();
  if (headerPassword) {
    return headerPassword;
  }
  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  if (authHeader) {
    return authHeader;
  }
  const { searchParams } = new URL(request.url);
  const queryPassword = searchParams.get("password")?.trim();
  if (queryPassword) {
    return queryPassword;
  }
  if (request.method !== "GET") {
    try {
      const payload = await request.json();
      const bodyPassword =
        typeof payload?.password === "string" ? payload.password.trim() : "";
      if (bodyPassword) {
        return bodyPassword;
      }
    } catch (error) {
      // ignore body parsing errors
    }
  }
  return "";
}

async function isAuthorized(request) {
  const password = await extractPassword(request);
  return password === ADMIN_PASSWORD;
}

export async function GET(request) {
  if (!(await isAuthorized(request))) {
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
        "telegram_chat_id",
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
