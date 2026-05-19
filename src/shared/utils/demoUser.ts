type MeLike = {
  licenseType?: string | null;
  subscriptionType?: string;
  demoLicense?: unknown;
};

export function isDemoUserFromMe(me: MeLike | null | undefined): boolean {
  if (!me) {
    return false;
  }
  const licenseType = (me.licenseType || "").toLowerCase();
  const subscriptionType = (me.subscriptionType || "").toLowerCase();
  return (
    !!me.demoLicense ||
    licenseType === "demo" ||
    subscriptionType === "demo" ||
    subscriptionType.includes("demo")
  );
}

export function isDemoUserFromStorage(): boolean {
  try {
    const current = JSON.parse(localStorage.getItem("current_user") || "null") as {
      licenseType?: string | null;
      subscriptionType?: string;
    } | null;
    const licenseType = (current?.licenseType || "").toLowerCase();
    const subscriptionType = (current?.subscriptionType || "").toLowerCase();
    return licenseType === "demo" || subscriptionType === "demo" || subscriptionType.includes("demo");
  } catch {
    return false;
  }
}

export function syncDemoUserFromMe(me: MeLike): void {
  if (!isDemoUserFromMe(me)) {
    return;
  }
  try {
    const current = JSON.parse(localStorage.getItem("current_user") || "{}") as Record<string, unknown>;
    const next = {
      ...current,
      licenseType: me.licenseType || "demo",
      subscriptionType: me.subscriptionType ?? current.subscriptionType,
      hasValidLicense: true,
    };
    localStorage.setItem("current_user", JSON.stringify(next));
    localStorage.setItem("licenseValid", "true");
  } catch {
    /* ignore */
  }
}
