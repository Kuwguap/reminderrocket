"use strict";

import crypto from "node:crypto";

/**
 * One-tap "Stop reminder" links sent in SMS use a short HMAC token so anyone
 * with the link can mark a single reminder completed without a login. The
 * token is derived from the reminder id + a server-side secret, so links are
 * unforgeable but stable (same link in every SMS for a given reminder).
 *
 * Secret resolution order:
 *   1. STOP_TOKEN_SECRET (preferred — dedicated key)
 *   2. SUPABASE_SERVICE_ROLE_KEY (always present where SMS sends from)
 */
function getSecret(env = process.env) {
  return (
    String(env.STOP_TOKEN_SECRET ?? "").trim() ||
    String(env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim() ||
    ""
  );
}

const TOKEN_LENGTH = 16;

/**
 * @param {string} reminderId
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | null} Base64url-encoded token, or null when no secret is set.
 */
export function buildStopToken(reminderId, env = process.env) {
  const secret = getSecret(env);
  if (!secret || !reminderId) {
    return null;
  }
  return crypto
    .createHmac("sha256", secret)
    .update(`stop:${reminderId}`)
    .digest("base64url")
    .slice(0, TOKEN_LENGTH);
}

/**
 * Constant-time check that `token` was signed for `reminderId`.
 * @param {string} reminderId
 * @param {string | null | undefined} token
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function verifyStopToken(reminderId, token, env = process.env) {
  if (!token || typeof token !== "string") return false;
  const expected = buildStopToken(reminderId, env);
  if (!expected) return false;
  if (expected.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(token, "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Build a public stop URL for SMS templates. Returns null when either the
 * APP_BASE_URL or the signing secret is not configured.
 * @param {string} reminderId
 * @param {string | null | undefined} appBaseUrl
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | null}
 */
export function buildStopUrl(reminderId, appBaseUrl, env = process.env) {
  if (!appBaseUrl || !reminderId) return null;
  const token = buildStopToken(reminderId, env);
  if (!token) return null;
  const base = String(appBaseUrl).replace(/\/+$/, "");
  return `${base}/s/${encodeURIComponent(reminderId)}?t=${encodeURIComponent(token)}`;
}
