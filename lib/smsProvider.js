"use strict";

import {
  isVonageConfigured,
  sendVonageSms,
} from "./vonageSms";
import {
  isHighlevelConfigured,
  sendHighlevelSms,
} from "./highlevelSms";

/**
 * Pick the SMS provider implementation. Set `SMS_PROVIDER=highlevel` to route
 * through GoHighLevel's A2P-verified number; anything else (default) uses
 * Vonage.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{
 *   provider: "highlevel" | "vonage",
 *   isConfigured: () => boolean,
 *   send: (opts: { to: string, body: string }) => Promise<unknown>,
 *   missingEnvHint: string,
 * }}
 */
export function getSmsProvider(env = process.env) {
  const choice = String(env.SMS_PROVIDER ?? "").trim().toLowerCase();
  if (choice === "highlevel" || choice === "ghl") {
    return {
      provider: "highlevel",
      isConfigured: () => isHighlevelConfigured(env),
      send: (opts) => sendHighlevelSms({ ...opts, env }),
      missingEnvHint:
        "SMS requires GoHighLevel: set HIGHLEVEL_PIT_TOKEN and HIGHLEVEL_LOCATION_ID.",
    };
  }
  return {
    provider: "vonage",
    isConfigured: () => isVonageConfigured(env),
    send: (opts) => sendVonageSms({ ...opts, env }),
    missingEnvHint:
      "SMS requires Vonage: set VONAGE_API_KEY, VONAGE_API_SECRET, and VONAGE_SMS_FROM.",
  };
}

/** Convenience helpers so call sites stay short. */
export function isSmsConfigured(env = process.env) {
  return getSmsProvider(env).isConfigured();
}

export async function sendSms({ to, body, env = process.env }) {
  return getSmsProvider(env).send({ to, body });
}
