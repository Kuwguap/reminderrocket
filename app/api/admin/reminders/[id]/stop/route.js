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

export async function POST(request, { params }) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let reminderId = params?.id;
  if (!reminderId) {
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(/\/api\/admin\/reminders\/([^/]+)\/stop$/);
    reminderId = match?.[1] ?? null;
  }
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
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }

  await supabase.from("reminder_attempts").insert({
    reminder_id: reminderId,
    channel: "system",
    status: "stopped",
    error_message: null,
  });

  return NextResponse.json({ reminder: data });
}
