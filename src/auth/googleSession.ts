// Only the native Google SDK can complete an authorization session. This flag
// prevents a duplicate JS URL event from navigating away from its caller.
let active = false;

export function isGoogleSignInActive() {
  return active;
}

export async function withGoogleSignInSession<T>(operation: () => Promise<T>): Promise<T> {
  if (active) {
    const error = new Error("Sign in already in progress");
    error.name = "IN_PROGRESS";
    throw error;
  }
  active = true;
  try {
    return await operation();
  } finally {
    active = false;
  }
}
