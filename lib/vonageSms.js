"use strict";

/**
 * Transactional SMS via Vonage SMS API (JSON).
 * Env: VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_SMS_FROM (or VONAGE_FROM_NUMBER).
 * Legacy aliases: NEXMO_API_KEY, NEXMO_API_SECRET.
 */

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getVonageConfigFromEnv(env = process.env) {
  const apiKey =
    trimEnv(env.VONAGE_API_KEY) || trimEnv(env.NEXMO_API_KEY);
  const apiSecret =
    trimEnv(env.VONAGE_API_SECRET) || trimEnv(env.NEXMO_API_SECRET);
  const from =
    trimEnv(env.VONAGE_SMS_FROM) ||
    trimEnv(env.VONAGE_FROM_NUMBER) ||
    trimEnv(env.VONAGE_FROM);

  if (!apiKey || !apiSecret || !from) {
    return null;
  }

  return { apiKey, apiSecret, from };
}

export function isVonageConfigured(env = process.env) {
  return getVonageConfigFromEnv(env) != null;
}

/**
 * Best-effort E.164: keeps +prefixed digits; US 10-digit → +1…
 */
export function normalizeSmsDestination(phone) {
  const trimmed = String(phone).trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length >= 8) {
    return `+${digitsOnly}`;
  }
  return null;
}

/** Vonage `to` expects MSISDN without leading +. */
function toVonageMsisdn(e164) {
  if (!e164) {
    return null;
  }
  return e164.replace(/^\+/, "").replace(/\D/g, "") || null;
}

/**
 * Vonage accepts numeric sender (digits) or alphanumeric (max 11 chars).
 */
function formatVonageFrom(from) {
  const t = String(from).trim();
  if (!t) {
    return "";
  }
  if (/^\d/.test(t) || t.startsWith("+")) {
    return t.replace(/^\+/, "").replace(/\D/g, "");
  }
  return t.slice(0, 11);
}

/**
 * @param {{ to: string, body: string, env?: Record<string, string | undefined> }} opts
 */
export async function sendVonageSms({ to, body, env = process.env }) {
  const config = getVonageConfigFromEnv(env);
  if (!config) {
    throw new Error("Vonage is not configured (missing env vars).");
  }

  const toE164 = normalizeSmsDestination(to);
  const toMsisdn = toVonageMsisdn(toE164);
  if (!toMsisdn) {
    throw new Error(
      "Invalid phone number. Use E.164 (e.g. +15551234567 or US 10-digit)."
    );
  }

  const payload = {
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    to: toMsisdn,
    from: formatVonageFrom(config.from),
    text: String(body).slice(0, 1600),
  };

  const response = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || `Vonage request failed (${response.status}).`);
  }

  const first = data?.messages?.[0];
  if (!first) {
    throw new Error(text || "Vonage returned an unexpected response.");
  }

  const status = String(first.status ?? "");
  if (status !== "0") {
    const err =
      first["error-text"] ||
      first["error_text"] ||
      `Vonage SMS failed (status ${status}).`;
    throw new Error(err);
  }

  return data;
}
