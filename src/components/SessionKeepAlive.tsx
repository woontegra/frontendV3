import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";
import { getAccessToken, isTokenExpired, refreshAccessToken } from "@/auth/authToken";

/** Same scope as V2: no heartbeat / background refresh on these anonymous auth pages */
const ANONYMOUS_AUTH_PATHS = ["/login", "/forgot-password", "/reset-password", "/unsubscribe"] as const;

export default function SessionKeepAlive() {
  const location = useLocation();
  const navigate = useNavigate();
  const { show } = useToast();

  useEffect(() => {
    const handleAuthExpired = () => {
      console.warn("[AUTH] Session expired");
      show({ title: "Oturum süreniz doldu", variant: "error" });
      navigate("/login");
    };
    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, [navigate, show]);

  useEffect(() => {
    const onAnonymousAuthPage = (ANONYMOUS_AUTH_PATHS as readonly string[]).includes(location.pathname);
    const token = getAccessToken();
    if (onAnonymousAuthPage || !token) return;

    const sendHeartbeat = () => {
      void apiClient(`/api/heartbeat`, { method: "POST" }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30 * 1000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  useEffect(() => {
    const onAnonymousAuthPage = (ANONYMOUS_AUTH_PATHS as readonly string[]).includes(location.pathname);
    if (onAnonymousAuthPage) return;
    if (!getAccessToken()) return;

    const checkAndRefreshToken = async () => {
      if (!isTokenExpired()) return;
      if (import.meta.env.DEV) console.log("[BACKGROUND REFRESH] Token expiring soon, refreshing...");
      try {
        const newToken = await refreshAccessToken();
        if (import.meta.env.DEV) {
          if (newToken) console.log("[BACKGROUND REFRESH] Token refreshed successfully");
          else console.error("[BACKGROUND REFRESH] Token refresh failed");
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error("[BACKGROUND REFRESH] Token refresh error:", e);
      }
    };

    void checkAndRefreshToken();
    const interval = setInterval(() => void checkAndRefreshToken(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  return null;
}
