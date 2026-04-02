"use strict";

/**
 * Transactional SMS via Twilio REST API (no third-party marketing flows).
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_MESSAGING_SERVICE_SID
 * or TWILIO_FROM_NUMBER / TWILIO_PHONE_NUMBER.
 */

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getTwilioConfigFromEnv(env = process.env) {
  const accountSid = trimEnv(env.TWILIO_ACCOUNT_SID);
  const authToken = trimEnv(env.TWILIO_AUTH_TOKEN);
  const from =
    trimEnv(env.TWILIO_FROM_NUMBER) || trimEnv(env.TWILIO_PHONE_NUMBER);
  const messagingServiceSid = trimEnv(env.TWILIO_MESSAGING_SERVICE_SID);

  if (!accountSid || !authToken) {
    return null;
  }
  if (!messagingServiceSid && !from) {
    return null;
  }

  return { accountSid, authToken, from: from || null, messagingServiceSid };
}

export function isTwilioConfigured(env = process.env) {
  return getTwilioConfigFromEnv(env) != null;
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

/**
 * @param {{ to: string, body: string, env?: Record<string, string | undefined> }} opts
 */
export async function sendTwilioSms({ to, body, env = process.env }) {
  const config = getTwilioConfigFromEnv(env);
  if (!config) {
    throw new Error("Twilio is not configured (missing env vars).");
  }

  const toE164 = normalizeSmsDestination(to);
  if (!toE164) {
    throw new Error(
      "Invalid phone number. Use E.164 (e.g. +15551234567 or US 10-digit)."
    );
  }

  const params = new URLSearchParams();
  params.set("To", toE164);
  params.set("Body", String(body).slice(0, 1600));

  if (config.messagingServiceSid) {
    params.set("MessagingServiceSid", config.messagingServiceSid);
  } else {
    params.set("From", config.from);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const auth = Buffer.from(
    `${config.accountSid}:${config.authToken}`
  ).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Twilio request failed (${response.status}).`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
