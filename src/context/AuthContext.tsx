import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/utils/apiClient";
import { clearTokens } from "@/auth/authToken";
import { normalizeUserRole } from "@/shared/utils/profilePicture";

export type AuthUser = {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  tenantId?: number;
  profilePicture?: string;
  hasValidLicense?: boolean;
  licenseType?: string | null;
  licenseActive?: boolean;
  licenseStatus?: string;
} | null;

type AuthContextType = {
  user: AuthUser;
  setUser: (u: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapApiUser(data: Record<string, unknown>, profilePictureFallback?: string): AuthUser {
  const profilePicture =
    (typeof data.profilePicture === "string" && data.profilePicture) ||
    profilePictureFallback ||
    undefined;

  return {
    id: typeof data.id === "number" ? data.id : undefined,
    name: typeof data.name === "string" ? data.name : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
    phone: typeof data.phone === "string" ? data.phone : undefined,
    company: typeof data.company === "string" ? data.company : undefined,
    role: normalizeUserRole(data.role),
    tenantId: typeof data.tenantId === "number" ? data.tenantId : undefined,
    profilePicture,
    hasValidLicense: data.licenseStatus === "OK",
    licenseType: typeof data.licenseType === "string" ? data.licenseType : null,
    licenseActive: data.licenseActive !== false,
    licenseStatus: typeof data.licenseStatus === "string" ? data.licenseStatus : undefined,
  };
}

function loadUserFromStorage(): AuthUser {
  const stored = localStorage.getItem("current_user");
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return mapApiUser(parsed, typeof parsed.profilePicture === "string" ? parsed.profilePicture : undefined);
  } catch {
    localStorage.removeItem("current_user");
    return null;
  }
}

function persistUser(user: AuthUser) {
  if (!user) {
    return;
  }
  localStorage.setItem("current_user", JSON.stringify(user));
  if (user.email) {
    localStorage.setItem("email", user.email);
  }
  if (user.tenantId != null) {
    localStorage.setItem("tenant_id", String(user.tenantId));
  }
  if (user.role) {
    localStorage.setItem("user_role", user.role);
  }
  if (user.id != null) {
    localStorage.setItem("user_id", String(user.id));
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);

  const applyUser = useCallback((next: AuthUser) => {
    setUser(next);
    if (next) {
      persistUser(next);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      return;
    }

    const stored = localStorage.getItem("current_user");
    let email: string | null = null;
    let profileFallback: string | undefined;

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        email = typeof parsed.email === "string" ? parsed.email : null;
        profileFallback =
          typeof parsed.profilePicture === "string" ? parsed.profilePicture : undefined;
      } catch {
        /* ignore */
      }
    }

    if (!email) {
      return;
    }

    try {
      const response = await apiClient(`/api/auth/me?email=${encodeURIComponent(email)}`);

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        const updatedUser = mapApiUser(data, profileFallback);
        applyUser(updatedUser);
        return;
      }

      const fallback = loadUserFromStorage();
      if (fallback) {
        applyUser(fallback);
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      const fallback = loadUserFromStorage();
      if (fallback) {
        applyUser(fallback);
      }
    }
  }, [applyUser]);

  const syncFromStorage = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      return;
    }
    const storedUser = loadUserFromStorage();
    if (storedUser) {
      setUser(storedUser);
    }
    void refreshUserData();
  }, [refreshUserData]);

  useEffect(() => {
    syncFromStorage();

    const onAuthChanged = () => {
      syncFromStorage();
    };

    window.addEventListener("auth-changed", onAuthChanged);
    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
    };
  }, [syncFromStorage]);

  useEffect(() => {
    if (user) {
      persistUser(user);
    }
  }, [user?.profilePicture, user?.name, user?.role, user?.email]);

  const logout = () => {
    clearTokens();
    localStorage.removeItem("v3_session");
    setUser(null);
    window.dispatchEvent(new Event("auth-changed"));
    window.location.href = "/login";
  };

  const value = useMemo(
    () => ({ user, setUser: applyUser, logout, refreshUser: refreshUserData }),
    [user, applyUser, logout, refreshUserData],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
