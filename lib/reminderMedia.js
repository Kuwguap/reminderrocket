"use strict";

import { Buffer } from "node:buffer";

export const REMINDER_MEDIA_BUCKET = "reminder-proofs";

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_VOICE_BYTES = 50 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 60;
export const MAX_MEDIA_MB = 50;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_VOICE_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

function sanitizeFilename(name, fallback) {
  const cleaned = String(name ?? "")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

function voiceExtension(contentType) {
  switch (contentType) {
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "mp3";
  }
}

/**
 * @param {File | Blob} file
 * @param {"image" | "voice"} kind
 * @returns {string | null}
 */
export function validateReminderMediaFile(file, kind) {
  if (!file || typeof file === "string") {
    return kind === "image" ? "Image file is required." : "Voice note is required.";
  }

  const contentType = file.type || "";
  const size = file.size ?? 0;

  if (kind === "image") {
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return "Image must be JPEG, PNG, WebP, or GIF.";
    }
    if (size > MAX_IMAGE_BYTES) {
      return `Image must be ${MAX_MEDIA_MB} MB or smaller.`;
    }
    return null;
  }

  if (!ALLOWED_VOICE_TYPES.has(contentType) && !contentType.startsWith("audio/")) {
    return "Voice note must be an audio recording.";
  }
  if (size > MAX_VOICE_BYTES) {
    return `Voice note must be ${MAX_MEDIA_MB} MB or smaller.`;
  }
  return null;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ reminderId: string, file: File | Blob, kind: "image" | "voice", filename?: string }} opts
 */
export async function uploadReminderMedia(supabase, { reminderId, file, kind, filename }) {
  const validationError = validateReminderMediaFile(file, kind);
  if (validationError) {
    throw new Error(validationError);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = file.type || (kind === "image" ? "image/jpeg" : "audio/mpeg");
  const safeName =
    kind === "image"
      ? sanitizeFilename(filename, "reminder.jpg")
      : sanitizeFilename(filename, voiceExtension(contentType));
  const filePath = `reminder-media/${reminderId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(REMINDER_MEDIA_BUCKET)
    .upload(filePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return filePath;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string | null | undefined} path
 * @param {number} [expiresInSeconds]
 * @returns {Promise<string | null>}
 */
export async function createReminderMediaSignedUrl(
  supabase,
  path,
  expiresInSeconds = 60 * 60 * 24
) {
  if (!path) {
    return null;
  }
  const { data, error } = await supabase.storage
    .from(REMINDER_MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}

/**
 * @param {string} text
 * @param {{ imageUrl?: string | null, voiceUrl?: string | null }} media
 */
export function appendMediaLinksToText(text, { imageUrl, voiceUrl }) {
  let result = text ?? "";
  if (imageUrl) {
    result += `${result ? "\n" : ""}View image: ${imageUrl}`;
  }
  if (voiceUrl) {
    result += `${result ? "\n" : ""}Listen: ${voiceUrl}`;
  }
  return result;
}

export const REMINDER_EMAIL_IMAGE_CID = "reminder-image";
export const REMINDER_EMAIL_VOICE_CID = "reminder-voice";

function mediaFilenameFromPath(path, fallback) {
  const parts = String(path ?? "").split("/");
  return parts[parts.length - 1] || fallback;
}

/**
 * Download reminder media from Supabase storage for email attachments.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string | null | undefined} path
 */
export async function downloadReminderMediaFile(supabase, path) {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(REMINDER_MEDIA_BUCKET)
    .download(path);

  if (error || !data) {
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return {
    buffer,
    contentType: data.type || "application/octet-stream",
    filename: mediaFilenameFromPath(path, "reminder-media"),
  };
}

/**
 * Build Resend inline attachments for reminder image/voice.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ image_path?: string | null, voice_path?: string | null }} reminder
 */
export async function buildReminderEmailMedia(supabase, reminder) {
  /** @type {Array<{ filename: string, content: string, content_type: string, content_id: string }>} */
  const attachments = [];
  const inlineImageCid = reminder.image_path ? REMINDER_EMAIL_IMAGE_CID : null;
  const inlineVoiceCid = reminder.voice_path ? REMINDER_EMAIL_VOICE_CID : null;

  if (reminder.image_path) {
    const file = await downloadReminderMediaFile(supabase, reminder.image_path);
    if (file) {
      attachments.push({
        filename: file.filename,
        content: file.buffer.toString("base64"),
        content_type: file.contentType,
        content_id: REMINDER_EMAIL_IMAGE_CID,
      });
    }
  }

  if (reminder.voice_path) {
    const file = await downloadReminderMediaFile(supabase, reminder.voice_path);
    if (file) {
      attachments.push({
        filename: file.filename.endsWith(".mp3")
          ? file.filename
          : "voice-note.mp3",
        content: file.buffer.toString("base64"),
        content_type: file.contentType.startsWith("audio/")
          ? file.contentType
          : "audio/mpeg",
        content_id: REMINDER_EMAIL_VOICE_CID,
      });
    }
  }

  return {
    attachments,
    inlineImageCid: attachments.some((a) => a.content_id === REMINDER_EMAIL_IMAGE_CID)
      ? inlineImageCid
      : null,
    inlineVoiceCid: attachments.some((a) => a.content_id === REMINDER_EMAIL_VOICE_CID)
      ? inlineVoiceCid
      : null,
  };
}
