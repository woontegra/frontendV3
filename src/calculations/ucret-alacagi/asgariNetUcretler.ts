/**
 * Dönemsel asgari NET ücret tablosu.
 * Kaynak: ucretAlacagi.service.js → ASGARI_UCRET_DONEMLERI (value alanı).
 */

export interface AsgariNetUcretDonem {
  start: string;
  end: string;
  net: number;
}

export const asgariNetUcretler: AsgariNetUcretDonem[] = [
  { start: "2015-01-01", end: "2015-06-30", net: 949.07 },
  { start: "2015-07-01", end: "2015-12-31", net: 1000.54 },
  { start: "2016-01-01", end: "2016-12-31", net: 1300.99 },
  { start: "2017-01-01", end: "2017-12-31", net: 1404.06 },
  { start: "2018-01-01", end: "2018-12-31", net: 1603.12 },
  { start: "2019-01-01", end: "2019-12-31", net: 2020.9 },
  { start: "2020-01-01", end: "2020-12-31", net: 2324.71 },
  { start: "2021-01-01", end: "2021-12-31", net: 2825.9 },
  { start: "2022-01-01", end: "2022-06-30", net: 4253.4 },
  { start: "2022-07-01", end: "2022-12-31", net: 5500.35 },
  { start: "2023-01-01", end: "2023-06-30", net: 8506.8 },
  { start: "2023-07-01", end: "2023-12-31", net: 11402.32 },
  { start: "2024-01-01", end: "2024-12-31", net: 17002.12 },
  { start: "2025-01-01", end: "2025-12-31", net: 22104.67 },
  { start: "2026-01-01", end: "2026-12-31", net: 28075.0 },
];

export function getAsgariNetUcretByDate(dateString: string): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const found = asgariNetUcretler.find((u) => date >= new Date(u.start) && date <= new Date(u.end));
  return found ? found.net : null;
}

export function getAsgariNetUcretForPeriod(startISO: string): number | null {
  return getAsgariNetUcretByDate(startISO);
}
