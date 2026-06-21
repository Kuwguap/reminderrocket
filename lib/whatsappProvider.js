"use strict";

import {
  isHighlevelConfigured,
  sendHighlevelWhatsApp,
} from "./highlevelWhatsApp";

/**
 * WhatsApp delivery via GoHighLevel (same credentials as HighLevel SMS).
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function getWhatsAppProvider(env = process.env) {
  return {
    provider: "highlevel",
    isConfigured: () => isHighlevelConfigured(env),
    send: (opts) => sendHighlevelWhatsApp({ ...opts, env }),
    missingEnvHint:
      "WhatsApp requires GoHighLevel: set HIGHLEVEL_PIT_TOKEN and HIGHLEVEL_LOCATION_ID, and connect WhatsApp on the sub-account.",
  };
}

export function isWhatsAppConfigured(env = process.env) {
  return getWhatsAppProvider(env).isConfigured();
}

export async function sendWhatsApp({ to, body, env = process.env }) {
  return getWhatsAppProvider(env).send({ to, body });
}
