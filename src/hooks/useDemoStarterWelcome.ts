import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/apiClient";
import { trackDemoOnboardingEvent } from "@/shared/utils/demoOnboarding";
import {
  isDemoUserFromMe,
  isDemoUserFromStorage,
  syncDemoUserFromMe,
} from "@/shared/utils/demoUser";

type MePayload = {
  licenseType?: string | null;
  subscriptionType?: string;
  demoLicense?: { type?: string } | null;
};

function readStoredEmail(): string {
  try {
    const current = JSON.parse(localStorage.getItem("current_user") || "null") as {
      email?: string;
    } | null;
    return (current?.email || localStorage.getItem("email") || "").trim().toLowerCase();
  } catch {
    return (localStorage.getItem("email") || "").trim().toLowerCase();
  }
}

export function useDemoStarterWelcome() {
  const [open, setOpen] = useState(false);
  const [userKey, setUserKey] = useState("anonymous");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!localStorage.getItem("access_token")) {
        return;
      }

      const email = readStoredEmail();
      if (!email) {
        return;
      }

      if (cancelled) {
        return;
      }
      setUserKey(email);

      let isDemo = isDemoUserFromStorage();

      if (!isDemo) {
        try {
          const me = await apiClient<MePayload>(`/api/auth/me?email=${encodeURIComponent(email)}`);
          if (cancelled) {
            return;
          }
          isDemo = isDemoUserFromMe(me);
          if (isDemo) {
            syncDemoUserFromMe(me);
          }
        } catch {
          /* getMe başarısızsa storage sinyaline güven */
        }
      }

      if (cancelled || !isDemo) {
        return;
      }

      const seenKey = `starter_welcome_seen_${email}`;
      const hideKey = `starter_welcome_hide_${email}`;
      const alreadySeen = localStorage.getItem(seenKey) === "1";
      const hideForever = localStorage.getItem(hideKey) === "1";

      if (!alreadySeen && !hideForever) {
        setOpen(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void trackDemoOnboardingEvent("modal_shown");
  }, [open]);

  const handleClose = useCallback(
    (dontShowAgain: boolean) => {
      const seenKey = `starter_welcome_seen_${userKey}`;
      const hideKey = `starter_welcome_hide_${userKey}`;
      localStorage.setItem(seenKey, "1");
      if (dontShowAgain) {
        localStorage.setItem(hideKey, "1");
      }
      setOpen(false);
      void trackDemoOnboardingEvent("modal_closed", { dontShowAgain });
    },
    [userKey],
  );

  return { open, onClose: handleClose };
}
