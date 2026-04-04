/**
 * Rows for UI: where reminder alerts are delivered (email, SMS, Telegram).
 * @param {{ email?: string | null, phone?: string | null, telegram_chat_id?: number | string | null }} reminder
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function getNotificationDestinationRows(reminder) {
  const rows = [];
  if (reminder.email && String(reminder.email).trim()) {
    rows.push({
      key: "email",
      label: "Email",
      value: String(reminder.email).trim(),
    });
  }
  if (reminder.phone && String(reminder.phone).trim()) {
    rows.push({
      key: "sms",
      label: "SMS",
      value: String(reminder.phone).trim(),
    });
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
