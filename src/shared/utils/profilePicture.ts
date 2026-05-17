import { API_BASE_URL } from "@/api/apiClient";

/** Backend'in 404 yerine döndürdüğü 1×1 şeffaf PNG — yüklü gibi görünür, aslında boş */
export function isPlaceholderAvatarDimensions(
  width: number,
  height: number,
): boolean {
  return width > 0 && width <= 2 && height > 0 && height <= 2;
}

function pickProfilePicturePath(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

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
 * `profilePictureUrl` (auth/me) varsa önceliklidir — VITE_API_URL hatalı olsa bile çalışır.
 */
export function resolveProfilePictureUrl(
  userId: number | string | undefined,
  profilePicture: string | null | undefined,
  profilePictureUrl?: string | null,
): string | null {
  const base64 = getStoredAvatarBase64(userId);
  if (base64) {
    return base64;
  }

  const resolved = pickProfilePicturePath(profilePictureUrl, profilePicture);
  if (!resolved) {
    return null;
  }

  if (
    resolved.startsWith("data:image/") ||
    resolved.startsWith("http://") ||
    resolved.startsWith("https://")
  ) {
    return resolved;
  }

  const path = resolved.startsWith("/") ? resolved : `/${resolved}`;
  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
  }
  return path;
}

/** API kullanıcı nesnesinden profil resmi alanlarını okur */
export function profilePictureFromApiUser(
  data: Record<string, unknown> | null | undefined,
): { profilePicture?: string; profilePictureUrl?: string } {
  if (!data) {
    return {};
  }
  const profilePictureUrl = pickProfilePicturePath(
    typeof data.profilePictureUrl === "string" ? data.profilePictureUrl : undefined,
  );
  const profilePicture = pickProfilePicturePath(
    typeof data.profilePicture === "string" ? data.profilePicture : undefined,
    typeof data.profile_picture === "string" ? data.profile_picture : undefined,
  );
  return { profilePicture, profilePictureUrl };
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
