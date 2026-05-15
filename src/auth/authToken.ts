const API_URL = import.meta.env.VITE_API_URL ?? "";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const TOKEN_EXPIRY_KEY = "token_expiry";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    name?: string;
    role?: string;
    tenantId?: number;
    profilePicture?: string;
  };
  licenseType?: string | null;
  professionalLicenseValid?: boolean;
  professionalLicense?: {
    license_key?: string;
    expires_at?: string;
  };
  requirePasswordChange?: boolean;
};

function decodeTokenExpiry(token: string): number | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(""),
    );
    const decoded = JSON.parse(jsonPayload) as { exp?: number };
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

  const expiryTime = decodeTokenExpiry(accessToken);
  if (expiryTime) {
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryTime));
  } else {
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + 2 * 60 * 60 * 1000));
  }
}

const AUTH_KEYS = [
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRY_KEY,
  "tenant_id",
  "user_id",
  "user_role",
  "current_user",
  "email",
  "licenseValid",
  "professionalLicenseKey",
  "professionalLicenseExpiry",
  "professional_device_id",
  "licenseExpiry",
  "user",
] as const;

export function clearTokens(): void {
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key);
  }
}

export function isTokenExpired(): boolean {
  const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryTime) {
    return true;
  }

  const expiry = Number.parseInt(expiryTime, 10);
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() >= expiry - fiveMinutes;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
      user?: LoginResponse["user"];
    };

    if (!data.accessToken || !data.refreshToken) {
      throw new Error("Invalid refresh response");
    }

    saveTokens(data.accessToken, data.refreshToken);

    if (data.user) {
      localStorage.setItem("current_user", JSON.stringify(data.user));
      localStorage.setItem("tenant_id", String(data.user.tenantId || "1"));
      localStorage.setItem("email", data.user.email);
    }

    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

export async function login(
  email: string,
  password: string,
  baroTrackingToken = "",
): Promise<LoginResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (baroTrackingToken) {
    headers["X-Baro-Tracking-Token"] = baroTrackingToken;
  }

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || "Giriş başarısız");
  }

  const data = (await response.json()) as LoginResponse;
  saveTokens(data.accessToken, data.refreshToken);

  const userWithLicense = {
    ...data.user,
    licenseType: data.licenseType ?? null,
    hasValidLicense: data.professionalLicenseValid ?? false,
  };
  localStorage.setItem("current_user", JSON.stringify(userWithLicense));
  localStorage.setItem("tenant_id", String(data.user.tenantId || "1"));
  localStorage.setItem("email", data.user.email);

  if (data.professionalLicenseValid) {
    localStorage.setItem("licenseValid", "true");
    localStorage.setItem("professionalLicenseKey", data.professionalLicense?.license_key || "");
    localStorage.setItem("professionalLicenseExpiry", data.professionalLicense?.expires_at || "");
  } else {
    localStorage.setItem("licenseValid", "false");
    localStorage.removeItem("professionalLicenseKey");
    localStorage.removeItem("professionalLicenseExpiry");
  }

  return data;
}
