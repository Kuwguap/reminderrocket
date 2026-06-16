import { splitRecipients } from "./recipientList";

/**
 * Rows for UI: where reminder alerts are delivered (email, SMS, Telegram).
 * Phone and email may contain a comma-separated list — each recipient gets
 * its own row.
 * @param {{ email?: string | null, phone?: string | null, telegram_chat_id?: number | string | null }} reminder
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function getNotificationDestinationRows(reminder) {
  const rows = [];
  for (const email of splitRecipients(reminder.email)) {
    rows.push({ key: `email:${email}`, label: "Email", value: email });
  }
  for (const phone of splitRecipients(reminder.phone)) {
    rows.push({ key: `sms:${phone}`, label: "SMS", value: phone });
  }
  if (reminder.telegram_chat_id != null && reminder.telegram_chat_id !== "") {
    rows.push({
      key: "telegram",
      label: "Telegram (chat ID)",
      value: String(reminder.telegram_chat_id),
    });
  }
  return rows;
}
