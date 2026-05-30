"use strict";

import { normalizeSmsDestination } from "./vonageSms";

/**
 * Transactional SMS via GoHighLevel Conversations API using the sub-account's
 * default A2P-verified number. Auth is a Private Integration Token (Sub-Account
 * → Settings → Private Integrations).
 *
 * Env:
 *   HIGHLEVEL_PIT_TOKEN    Private Integration Token (Bearer token)
 *   HIGHLEVEL_LOCATION_ID  Sub-account / Location ID that owns the A2P number
 *   HIGHLEVEL_API_VERSION  Optional, defaults to "2021-07-28"
 */

const HL_BASE_URL = "https://services.leadconnectorhq.com";
const DEFAULT_API_VERSION = "2021-07-28";

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getHighlevelConfigFromEnv(env = process.env) {
  const token = trimEnv(env.HIGHLEVEL_PIT_TOKEN);
  const locationId = trimEnv(env.HIGHLEVEL_LOCATION_ID);
  const version = trimEnv(env.HIGHLEVEL_API_VERSION) || DEFAULT_API_VERSION;
  if (!token || !locationId) {
    return null;
  }
  return { token, locationId, version };
}

export function isHighlevelConfigured(env = process.env) {
  return getHighlevelConfigFromEnv(env) != null;
}

function authHeaders(config) {
  return {
    Authorization: `Bearer ${config.token}`,
    Version: config.version,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function parseJsonOrThrow(response, label) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      text || `${label} returned non-JSON (HTTP ${response.status}).`
    );
  }
  if (!response.ok) {
    const detail =
      json?.message ||
      json?.error ||
      (Array.isArray(json?.errors) ? json.errors.join("; ") : null) ||
      `${label} failed (HTTP ${response.status}).`;
    throw new Error(detail);
  }
  return json;
}

/**
 * Upsert a contact by phone number; returns the contact id.
 * Idempotent — HighLevel returns the existing contact when phone matches.
 *
 * @param {{ config: ReturnType<typeof getHighlevelConfigFromEnv>, phoneE164: string }} opts
 * @returns {Promise<string>}
 */
async function upsertContactByPhone({ config, phoneE164 }) {
  const response = await fetch(`${HL_BASE_URL}/contacts/upsert`, {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify({
      locationId: config.locationId,
      phone: phoneE164,
    }),
  });
  const json = await parseJsonOrThrow(response, "HighLevel upsert");
  const id =
    json?.contact?.id ??
    json?.contactId ??
    json?.id ??
    json?.data?.contact?.id ??
    null;
  if (!id) {
    throw new Error("HighLevel upsert succeeded but did not return contactId.");
  }
  return id;
}

/**
 * Send an SMS through the GoHighLevel Conversations API.
 * Uses the location's default A2P-verified number; no `from` is configurable.
 *
 * @param {{ to: string, body: string, env?: Record<string, string | undefined> }} opts
 */
export async function sendHighlevelSms({ to, body, env = process.env }) {
  const config = getHighlevelConfigFromEnv(env);
  if (!config) {
    throw new Error(
      "HighLevel SMS is not configured. Set HIGHLEVEL_PIT_TOKEN and HIGHLEVEL_LOCATION_ID."
    );
  }

  const toE164 = normalizeSmsDestination(to);
  if (!toE164) {
    throw new Error(
      "Invalid phone number. Use E.164 (e.g. +15551234567 or US 10-digit)."
    );
  }

  const contactId = await upsertContactByPhone({ config, phoneE164: toE164 });

  const response = await fetch(`${HL_BASE_URL}/conversations/messages`, {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify({
      type: "SMS",
      contactId,
      message: String(body).slice(0, 1600),
    }),
  });

  const json = await parseJsonOrThrow(response, "HighLevel send");

  // HighLevel's POST returns 200 even when the message is rejected (e.g. daily
  // SMS quota hit). The carrier-side status lands on the message record about
  // a second later. Briefly poll once so we surface real failures to the cron.
  const messageId =
    json?.messageId ?? json?.message?.id ?? json?.data?.messageId ?? null;
  if (messageId) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const detailRes = await fetch(
        `${HL_BASE_URL}/conversations/messages/${encodeURIComponent(messageId)}`,
        { headers: authHeaders(config) }
      );
      if (detailRes.ok) {
        const detail = await detailRes.json().catch(() => null);
        const msg = detail?.message ?? detail ?? null;
        const status = String(msg?.status ?? "").toLowerCase();
        if (status === "failed" || status === "undelivered") {
          throw new Error(
            msg?.error ||
              `HighLevel marked the message ${status} (no reason returned).`
          );
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("HighLevel")) {
        throw error;
      }
      // Network blip while polling — leave the original "queued" optimism.
    }
  }

  return json;
}
