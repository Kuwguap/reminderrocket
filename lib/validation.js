import { z } from "zod";
import {
  canonicalizeList,
  isValidEmail,
  isValidPhone,
  splitRecipients,
} from "./recipientList";

const emptyToNull = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return value ?? null;
};

const phoneListSchema = z
  .string()
  .superRefine((value, ctx) => {
    const list = splitRecipients(value);
    if (list.length === 0) return;
    for (const p of list) {
      if (!isValidPhone(p)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid phone number: "${p}".`,
        });
      }
    }
  })
  .transform((value) => canonicalizeList(value));

const emailListSchema = z
  .string()
  .superRefine((value, ctx) => {
    const list = splitRecipients(value);
    if (list.length === 0) return;
    for (const e of list) {
      if (!isValidEmail(e)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid email: "${e}".`,
        });
      }
    }
  })
  .transform((value) => canonicalizeList(value));

export const reminderSchema = z
  .object({
    client_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
    message: z.preprocess(emptyToNull, z.string().nullable()),
    image_path: z.preprocess(emptyToNull, z.string().nullable()),
    voice_path: z.preprocess(emptyToNull, z.string().nullable()),
    recipient_name: z.preprocess(emptyToNull, z.string().nullable()),
    phone: z.preprocess(emptyToNull, phoneListSchema.nullable()),
    whatsapp: z.preprocess(emptyToNull, phoneListSchema.nullable()),
    email: z.preprocess(emptyToNull, emailListSchema.nullable()),
    frequency_type: z.enum(["hourly", "every-3-hours", "daily", "custom", "annoy"]),
    frequency_value: z.preprocess(
      (value) => (value === "" || value == null ? null : Number(value)),
      z.number().int().positive().nullable()
    ),
    frequency_unit: z.preprocess(
      emptyToNull,
      z.enum(["minutes", "hours", "days"]).nullable()
    ),
    start_time: z.string().datetime(),
    stop_condition: z.enum(["time", "proof"]),
    stop_at: z.preprocess(emptyToNull, z.string().datetime().nullable()),
    telegram_chat_id: z.preprocess((value) => {
      if (value === "" || value == null) {
        return null;
      }
      const n = typeof value === "number" ? value : Number(String(value));
      return Number.isFinite(n) ? n : null;
    }, z.number().int().nullable()),
  })
  .superRefine((data, ctx) => {
    if (!data.message && !data.image_path && !data.voice_path) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["message"],
        message: "Add a message, image, or voice note.",
      });
    }

    if (
      !data.phone &&
      !data.whatsapp &&
      !data.email &&
      data.telegram_chat_id == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Add SMS, WhatsApp, email, or Telegram for delivery.",
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Add SMS, WhatsApp, email, or Telegram for delivery.",
      });
    }

    if (data.frequency_type === "custom") {
      if (!data.frequency_value || !data.frequency_unit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["frequency_value"],
          message: "Custom frequency needs a value and unit.",
        });
      }
    }

    if (data.stop_condition === "time" && !data.stop_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stop_at"],
        message: "Stop time is required.",
      });
    }

    if (data.stop_condition === "time" && data.stop_at) {
      const startTime = Date.parse(data.start_time);
      const stopTime = Date.parse(data.stop_at);
      if (!Number.isNaN(startTime) && !Number.isNaN(stopTime)) {
        if (stopTime <= startTime) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["stop_at"],
            message: "Stop time must be after start time.",
          });
        }
      }
    }
  });

export function formatZodErrors(error) {
  return error.issues.reduce((acc, issue) => {
    const path = issue.path.join(".") || "form";
    if (!acc[path]) {
      acc[path] = issue.message;
    }
    return acc;
  }, {});
}
