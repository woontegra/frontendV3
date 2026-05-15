import { clearTokens, isTokenExpired, refreshAccessToken } from "@/auth/authToken";
import { getDeviceUUID } from "@/shared/utils/deviceUUID";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export type ApiClientOptions = RequestInit & {
  skipAuth?: boolean;
  skipTenantId?: boolean;
  skipDeviceUUID?: boolean;
};

function buildUrl(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/$/, "")}${endpoint}`;
  }

  return endpoint;
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { skipAuth = false, skipTenantId = false, skipDeviceUUID = false, headers, ...fetchOptions } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  if (fetchOptions.body && !requestHeaders.has("Content-Type")) {
    if (!(fetchOptions.body instanceof FormData)) {
      requestHeaders.set("Content-Type", "application/json");
    }
  }

  let token = skipAuth ? null : localStorage.getItem("access_token");
  if (token && isTokenExpired()) {
    token = await refreshAccessToken();
  }

  if (!skipAuth) {
    if (localStorage.getItem("v3_session")) {
      requestHeaders.set("X-Client-Session", "v3");
    }

    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const publicRoutes = ["/api/auth/", "/api/health", "/api/debug/"];
  const isPublicRoute = publicRoutes.some((route) => endpoint.includes(route));

  if (!skipTenantId && !isPublicRoute) {
    const tenantId = localStorage.getItem("tenant_id") || "1";
    const parsed = Number.parseInt(tenantId, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      clearTokens();
      throw new Error("TENANT_INVALID");
    }
    requestHeaders.set("X-Tenant-Id", String(parsed));
  }

  if (!skipDeviceUUID) {
    const deviceId = getDeviceUUID();
    requestHeaders.set("X-Device-Id", deviceId);
    requestHeaders.set("X-Device-UUID", deviceId);
  }

  const url = buildUrl(endpoint);
  let response = await fetch(url, {
    ...fetchOptions,
    headers: requestHeaders,
  });

  if (!skipAuth && response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
      });
    }

    if (response.status === 401) {
      clearTokens();
      throw new Error("Authentication required");
    }
  }

  if (!response.ok) {
    throw new Error(`API isteği başarısız: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}
