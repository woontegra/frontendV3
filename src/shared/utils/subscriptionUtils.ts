export interface SubscriptionCalc {
  startDate: Date | null;
  endDate: Date | null;
  totalDays: number;
  daysUsed: number;
  daysRemaining: number;
  usedPct: number;
  remainingPct: number;
  hasSubscription: boolean;
  isActive: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export function calculateSubscription(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): SubscriptionCalc {
  const empty: SubscriptionCalc = {
    startDate: null,
    endDate: null,
    totalDays: 0,
    daysUsed: 0,
    daysRemaining: 0,
    usedPct: 0,
    remainingPct: 0,
    hasSubscription: false,
    isActive: false,
    isExpired: true,
    isExpiringSoon: false,
  };

  if (!endsAt) {
    return empty;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endsAt);
    end.setHours(0, 0, 0, 0);
    const start = startsAt ? new Date(startsAt) : new Date();
    start.setHours(0, 0, 0, 0);

    if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) {
      return empty;
    }

    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
    const daysUsed = Math.max(0, totalDays - daysRemaining);
    const remainingPct = Math.round((daysRemaining / totalDays) * 1000) / 10;
    const usedPct = Math.round((daysUsed / totalDays) * 1000) / 10;

    return {
      startDate: start,
      endDate: end,
      totalDays,
      daysUsed,
      daysRemaining,
      usedPct,
      remainingPct,
      hasSubscription: true,
      isActive: daysRemaining > 0,
      isExpired: daysRemaining <= 0,
      isExpiringSoon: daysRemaining > 0 && daysRemaining <= 7,
    };
  } catch {
    return empty;
  }
}

export function subscriptionProgressClass(daysRemaining: number): string {
  if (daysRemaining > 30) {
    return "progressGreen";
  }
  if (daysRemaining > 7) {
    return "progressAmber";
  }
  return "progressRed";
}

export function subscriptionTextClass(daysRemaining: number): string {
  if (daysRemaining > 30) {
    return "textGreen";
  }
  if (daysRemaining > 7) {
    return "textAmber";
  }
  return "textRed";
}
