import { apiClient } from "@/utils/apiClient";

export type DemoOnboardingEventAction =
  | "modal_shown"
  | "modal_closed"
  | "modal_selection";

type DemoOnboardingPayload = {
  calculationType?: string;
  targetPath?: string;
  dontShowAgain?: boolean;
};

import { isDemoUserFromStorage } from "@/shared/utils/demoUser";

function isDemoUserLocal(): boolean {
  return isDemoUserFromStorage();
}

export async function trackDemoOnboardingEvent(
  action: DemoOnboardingEventAction,
  payload: DemoOnboardingPayload = {},
) {
  if (!isDemoUserLocal()) {
    return;
  }
  try {
    await apiClient("/api/demo-onboarding/events", {
      method: "POST",
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    // Tracking hatası kullanıcı deneyimini bozmasın
  }
}
