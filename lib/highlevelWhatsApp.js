"use strict";

import { normalizeSmsDestination } from "./vonageSms";
import {
  getHighlevelConfigFromEnv,
  isHighlevelConfigured,
  sendHighlevelConversationMessage,
  upsertContactByPhone,
} from "./highlevelClient";

export { getHighlevelConfigFromEnv, isHighlevelConfigured };

/**
 * Send a WhatsApp message through GoHighLevel Conversations API.
 * Requires WhatsApp to be connected on the sub-account. Free-form text
 * works inside Meta's 24-hour customer service window; outside that window
 * GHL may require an approved template.
 *
 * @param {{ to: string, body: string, env?: Record<string, string | undefined> }} opts
 */
export async function sendHighlevelWhatsApp({ to, body, env = process.env }) {
  const config = getHighlevelConfigFromEnv(env);
  if (!config) {
    throw new Error(
      "HighLevel WhatsApp is not configured. Set HIGHLEVEL_PIT_TOKEN and HIGHLEVEL_LOCATION_ID."
    );
  }

  const toE164 = normalizeSmsDestination(to);
  if (!toE164) {
    throw new Error(
      "Invalid WhatsApp number. Use E.164 (e.g. +15551234567 or US 10-digit)."
    );
  }

  const contactId = await upsertContactByPhone({ config, phoneE164: toE164 });

  return sendHighlevelConversationMessage({
    type: "WhatsApp",
    contactId,
    message: body,
    config,
    label: "HighLevel WhatsApp",
  });
}
