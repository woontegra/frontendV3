import { clearTokens } from "@/auth/authToken";

const SESSION_KEY = "v3_session";

export type Session = {
  email: string;
  name?: string;
};

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("access_token"));
}

export function getSession(): Session | null {
  try {
    const currentUser = JSON.parse(localStorage.getItem("current_user") || "null") as {
      email?: string;
      name?: string;
    } | null;
    if (currentUser?.email) {
      return {
        email: currentUser.email,
        name: currentUser.name,
      };
    }
  } catch {
    /* ignore invalid session payload */
  }

  const email = localStorage.getItem("email");
  if (!email) {
    return null;
  }

  return { email };
}

export function persistV3Session(email: string): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      email,
    } satisfies Session),
  );
}

export function signOut(): void {
  clearTokens();
  localStorage.removeItem(SESSION_KEY);
}
