import { z } from "zod";

const emptyToNull = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return value ?? null;
};

export const reminderSchema = z
  .object({
    client_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
    message: z.string().min(1, "Message is required."),
    recipient_name: z.preprocess(emptyToNull, z.string().nullable()),
    phone: z.preprocess(emptyToNull, z.string().nullable()),
    email: z.preprocess(emptyToNull, z.string().email().nullable()),
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
    if (!data.phone && !data.email && data.telegram_chat_id == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Add SMS, email, or Telegram for delivery.",
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Add SMS, email, or Telegram for delivery.",
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
