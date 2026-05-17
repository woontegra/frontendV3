import { API_BASE_URL } from "@/utils/apiClient";

/** Oturumdaki base64 avatar (yüklenen görsel, API erişilemese bile gösterilir) */
export function getStoredAvatarBase64(userId: number | string | undefined): string | null {
  if (userId == null || userId === "") {
    return null;
  }
  try {
    const raw = localStorage.getItem(`avatar_base64_${userId}`);
    if (raw && raw.startsWith("data:image/")) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Profil görseli URL'si: önce localStorage base64, sonra tam URL veya API tabanı + path.
 */
export function resolveProfilePictureUrl(
  userId: number | string | undefined,
  profilePicture: string | null | undefined,
): string | null {
  const base64 = getStoredAvatarBase64(userId);
  if (base64) {
    return base64;
  }

  if (!profilePicture?.trim()) {
    return null;
  }

  const trimmed = profilePicture.trim();
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
  }
  return path;
}

export function normalizeUserRole(role: unknown): string | undefined {
  if (typeof role !== "string" || !role.trim()) {
    return undefined;
  }
  return role.trim().toLowerCase();
}

export function isAdminRole(role: unknown, tenantId?: number | null): boolean {
  if (normalizeUserRole(role) === "admin") {
    return true;
  }
  return Number(tenantId) === 1;
}

export function roleDisplayLabel(role: unknown, tenantId?: number | null): string {
  if (isAdminRole(role, tenantId)) {
    return "Admin";
  }
  const r = normalizeUserRole(role);
  if (r === "user") {
    return "Kullanıcı";
  }
  if (r) {
    return r.charAt(0).toUpperCase() + r.slice(1);
  }
  return "Kullanıcı";
}
