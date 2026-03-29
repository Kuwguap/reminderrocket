/**
 * Resolve the signed-in user for API routes. Prefer getUser() (validated JWT);
 * fall back to getSession() when cookies exist but getUser is empty (timing / edge cases).
 */
export async function getServerAuthUser(authClient) {
  if (!authClient) {
    return null;
  }
  try {
    const {
      data: { user },
      error,
    } = await authClient.auth.getUser();
    if (!error && user) {
      return user;
    }
  } catch (error) {
    console.warn("Auth getUser failed:", error?.message ?? error);
  }
  try {
    const {
      data: { session },
      error,
    } = await authClient.auth.getSession();
    if (!error && session?.user) {
      return session.user;
    }
  } catch (error) {
    console.warn("Auth getSession failed:", error?.message ?? error);
  }
  return null;
}
