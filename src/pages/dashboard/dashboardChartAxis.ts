import type { UserInfo } from "./dashboardData";

const MAX_MONTHLY_WINDOW = 6;

export type MonthBucket = { key: string; month: number };

function parseValidDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hesap / abonelik başlangıcı: user.createdAt → subscriptionStartsAt → demo activatedAt */
export function getChartAccountStart(userInfo: UserInfo | null): Date | null {
  if (!userInfo) {
    return null;
  }
  const candidates = [
    userInfo.createdAt,
    userInfo.subscriptionStartsAt,
    userInfo.demoLicense?.activatedAt,
    userInfo.demoLicense?.createdAt,
  ]
    .map(parseValidDate)
    .filter((d): d is Date => d != null);

  if (candidates.length === 0) {
    return null;
  }
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function addCalendarMonths(year: number, monthIndex: number, delta: number): { year: number; month: number } {
  let m = monthIndex + delta;
  let y = year;
  while (m < 0) {
    m += 12;
    y -= 1;
  }
  while (m > 11) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

function calendarMonthsBetweenInclusive(start: Date, end: Date): MonthBucket[] {
  const s = monthStart(start);
  const e = monthStart(end);
  const buckets: MonthBucket[] = [];
  let { year, month } = { year: s.getFullYear(), month: s.getMonth() };
  const endKey = monthKey(e.getFullYear(), e.getMonth());

  while (true) {
    const key = monthKey(year, month);
    buckets.push({ key, month });
    if (key === endKey) {
      break;
    }
    ({ year, month } = addCalendarMonths(year, month, 1));
  }
  return buckets;
}

function monthsBetweenAccountAndNow(accountStart: Date, now: Date): number {
  const a = monthStart(accountStart);
  const n = monthStart(now);
  return (n.getFullYear() - a.getFullYear()) * 12 + (n.getMonth() - a.getMonth());
}

/**
 * Aylık grafik ekseni: hesap açılış ayından bugüne; 6+ ay geçmişse son 6 ay.
 */
export function buildMonthlyChartBuckets(now: Date, userInfo: UserInfo | null): MonthBucket[] {
  const accountStart = getChartAccountStart(userInfo);
  const nowMonth = monthStart(now);

  if (!accountStart) {
    const start = addCalendarMonths(now.getFullYear(), now.getMonth(), -(MAX_MONTHLY_WINDOW - 1));
    return calendarMonthsBetweenInclusive(
      new Date(start.year, start.month, 1),
      nowMonth,
    );
  }

  const accountMonth = monthStart(accountStart);
  const span = monthsBetweenAccountAndNow(accountStart, now);

  let rangeStart: Date;
  if (span >= MAX_MONTHLY_WINDOW) {
    const win = addCalendarMonths(now.getFullYear(), now.getMonth(), -(MAX_MONTHLY_WINDOW - 1));
    rangeStart = new Date(win.year, win.month, 1);
  } else {
    rangeStart = accountMonth;
  }

  return calendarMonthsBetweenInclusive(rangeStart, nowMonth);
}

/** Tümü filtresinde hesap öncesi ayları kes */
export function filterMonthKeysFromAccount(keys: string[], userInfo: UserInfo | null): string[] {
  const accountStart = getChartAccountStart(userInfo);
  if (!accountStart) {
    return keys;
  }
  const minKey = monthKey(accountStart.getFullYear(), accountStart.getMonth());
  return keys.filter((k) => k >= minKey);
}
