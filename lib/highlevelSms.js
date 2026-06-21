"use strict";

import { normalizeSmsDestination } from "./vonageSms";
import {
  getHighlevelConfigFromEnv,
  isHighlevelConfigured,
  sendHighlevelConversationMessage,
  upsertContactByPhone,
} from "./highlevelClient";

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

export { getHighlevelConfigFromEnv, isHighlevelConfigured };

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

  return sendHighlevelConversationMessage({
    type: "SMS",
    contactId,
    message: body,
    config,
    label: "HighLevel SMS",
  });
}
