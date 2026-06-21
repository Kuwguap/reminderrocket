"use strict";

/**
 * Shared GoHighLevel Conversations API helpers (SMS, WhatsApp, etc.).
 *
 * Env:
 *   HIGHLEVEL_PIT_TOKEN    Private Integration Token (Bearer token)
 *   HIGHLEVEL_LOCATION_ID  Sub-account / Location ID
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

export function authHeaders(config) {
  return {
    Authorization: `Bearer ${config.token}`,
    Version: config.version,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function parseJsonOrThrow(response, label) {
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
 *
 * @param {{ config: ReturnType<typeof getHighlevelConfigFromEnv>, phoneE164: string }} opts
 * @returns {Promise<string>}
 */
export async function upsertContactByPhone({ config, phoneE164 }) {
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
 * Poll once for async delivery failures (quota, WhatsApp window, etc.).
 *
 * @param {{ config: ReturnType<typeof getHighlevelConfigFromEnv>, json: object, label: string }} opts
 */
export async function pollHighlevelMessageStatus({ config, json, label }) {
  const messageId =
    json?.messageId ?? json?.message?.id ?? json?.data?.messageId ?? null;
  if (!messageId) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
  try {
    const detailRes = await fetch(
      `${HL_BASE_URL}/conversations/messages/${encodeURIComponent(messageId)}`,
      { headers: authHeaders(config) }
    );
    if (!detailRes.ok) {
      return;
    }
    const detail = await detailRes.json().catch(() => null);
    const msg = detail?.message ?? detail ?? null;
    const status = String(msg?.status ?? "").toLowerCase();
    if (status === "failed" || status === "undelivered") {
      throw new Error(
        msg?.error ||
          `${label} marked the message ${status} (no reason returned).`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("marked the message")) {
      throw error;
    }
    // Network blip while polling — leave the original "queued" optimism.
  }
}

/**
 * Send a conversation message (SMS, WhatsApp, etc.).
 *
 * @param {{
 *   type: "SMS" | "WhatsApp",
 *   contactId: string,
 *   message: string,
 *   config: ReturnType<typeof getHighlevelConfigFromEnv>,
 *   label: string,
 * }} opts
 */
export async function sendHighlevelConversationMessage({
  type,
  contactId,
  message,
  config,
  label,
}) {
  const response = await fetch(`${HL_BASE_URL}/conversations/messages`, {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify({
      type,
      contactId,
      message: String(message).slice(0, 1600),
    }),
  });

  const json = await parseJsonOrThrow(response, `${label} send`);
  await pollHighlevelMessageStatus({ config, json, label });
  return json;
}
