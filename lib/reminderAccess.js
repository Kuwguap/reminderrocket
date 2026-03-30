/**
 * List reminders for the home / “my reminders” view.
 * When signed in, scope by account only (`user_id`) so every device sees the same rows.
 * When anonymous, scope by `client_id` only.
 */
export function applyReminderListFilter(query, user, clientId) {
  if (user) {
    return query.eq("user_id", user.id);
  }
  if (clientId) {
    return query.eq("client_id", clientId);
  }
  return query;
}

/**
 * Restrict a Supabase query to reminders the caller may access (mutations: stop, proof, etc.).
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
