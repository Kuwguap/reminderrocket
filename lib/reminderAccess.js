/**
 * Restrict a Supabase query to reminders the caller may access.
 * When both session user and device client_id are present, match either (same browser + account).
 */
export function applyReminderOwnerFilter(query, user, clientId) {
  if (user && clientId) {
    return query.or(`user_id.eq.${user.id},client_id.eq.${clientId}`);
  }
  if (user) {
    return query.eq("user_id", user.id);
  }
  if (clientId) {
    return query.eq("client_id", clientId);
  }
  return query;
}
