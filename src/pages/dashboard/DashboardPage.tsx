import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Scale,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSubscriptionTypeLabel } from "@/shared/utils/labelMappings";
import {
  calculateSubscription,
  subscriptionProgressClass,
  subscriptionTextClass,
} from "@/shared/utils/subscriptionUtils";
import {
  formatCalculationType,
  MONTHS,
} from "./calculationTypeLabels";
import CalculationTypeDistributionChart from "./CalculationTypeDistributionChart";
import {
  buildMonthlyChartBuckets,
  filterMonthKeysFromAccount,
  getChartAccountStart,
} from "./dashboardChartAxis";
import {
  loadDashboardData,
  readDashboardUserRole,
  type SavedCase,
} from "./dashboardData";
import styles from "./DashboardPage.module.css";

const num = (n: number) => n.toLocaleString("tr-TR");

type Period = "haftalik" | "aylik" | "yillik" | "tum";

type RecentRow = {
  id: number;
  type: string;
  name: string;
  date: string;
  brut: number;
  net: number;
  data: Record<string, unknown> | null;
};

function formatAvgSeconds(seconds: number): string {
  if (seconds < 10) {
    return `${seconds.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sn`;
  }
  return `${Math.round(seconds).toLocaleString("tr-TR")} sn`;
}

function buildRecentRows(cases: SavedCase[]): RecentRow[] {
  return cases.slice(0, 10).map((c) => {
    let brut = Number(c.brut_total || c.brut_toplam || 0);
    let net = Number(c.net_total || c.net_toplam || 0);

    const tryParse = (raw: unknown) => {
      if (!raw) {
        return null;
      }
      try {
        return typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
      } catch {
        return null;
      }
    };

    if (!brut) {
      const src = tryParse(c.detay) ?? tryParse(c.data);
      if (src) {
        brut = Number(
          src.brutTazminat ??
            src.brutTazminatTutari ??
            src.brut_tazminat ??
            src.toplamBrut ??
            src.brutTotal ??
            src.brut_total ??
            0,
        );
        net = Number(
          src.netTazminat ??
            src.netTazminatTutari ??
            src.net_tazminat ??
            src.toplamNet ??
            src.netTotal ??
            src.net_total ??
            0,
        );
      }
    }

    const dateStr = c.created_at || c.createdAt;
    return {
      id: c.id,
      type: formatCalculationType(c.type || c.hesaplama_tipi || "Hesaplama"),
      name: c.name || c.aciklama || c.kayit_adi || "",
      date: dateStr ? new Date(dateStr).toLocaleDateString("tr-TR") : "-",
      brut,
      net,
      data: tryParse(c.data) ?? tryParse(c.detay),
    };
  });
}

function planBadgeClass(label: string): string {
  if (label === "Deneme") {
    return `${styles.planBadge} ${styles.planBadgeTrial}`;
  }
  const lower = label.toLowerCase();
  if (lower.includes("yıllık")) {
    return `${styles.planBadge} ${styles.planBadgeAnnual}`;
  }
  if (lower.includes("aylık")) {
    return `${styles.planBadge} ${styles.planBadgeMonthly}`;
  }
  return styles.planBadge;
}

export default function DashboardPage() {
  const { isAdmin } = readDashboardUserRole();

  const [loading, setLoading] = useState(true);
  const [savedCases, setSavedCases] = useState<SavedCase[]>([]);
  const [userInfo, setUserInfo] = useState<Awaited<ReturnType<typeof loadDashboardData>>["userInfo"]>(null);
  const [financial, setFinancial] = useState<Awaited<ReturnType<typeof loadDashboardData>>["financial"]>(null);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("aylik");
  const [detailRow, setDetailRow] = useState<RecentRow | null>(null);
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const data = await loadDashboardData(isAdmin);
        if (!cancelled) {
          setSavedCases(data.savedCases);
          setUserInfo(data.userInfo);
          setFinancial(data.financial);
          setFinancialError(data.financialError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const sub = useMemo(() => {
    const start = userInfo?.demoLicense?.activatedAt ?? userInfo?.subscriptionStartsAt;
    const end = userInfo?.demoLicense?.expiresAt ?? userInfo?.subscriptionEndsAt;
    return calculateSubscription(start, end);
  }, [userInfo]);

  const subTypeLabel = useMemo(() => {
    if (userInfo?.demoLicense) {
      return "Deneme";
    }
    const raw = getSubscriptionTypeLabel(userInfo?.subscriptionType);
    if (!raw || raw === "-") {
      return userInfo ? "Kullanıcı" : "-";
    }
    return raw;
  }, [userInfo]);

  const avgProcessingTimeSec = useMemo(() => {
    const recent = savedCases.slice(0, 10);
    let total = 0;
    let count = 0;
    recent.forEach((c) => {
      const created = c.createdAt || c.created_at;
      const updated = c.updatedAt || c.updated_at;
      if (created && updated) {
        const ms = new Date(updated).getTime() - new Date(created).getTime();
        if (ms > 0 && ms < 300_000) {
          total += ms / 1000;
          count += 1;
        }
      }
    });
    if (count === 0) {
      return null;
    }
    return total / count;
  }, [savedCases]);

  const monthlyCalculationCount = useMemo(() => {
    const now = new Date();
    return savedCases.filter((c) => {
      const source = c.created_at || c.createdAt;
      if (!source) {
        return false;
      }
      try {
        const d = new Date(source);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      } catch {
        return false;
      }
    }).length;
  }, [savedCases]);

  const lastLogin = useMemo(() => {
    const value = localStorage.getItem("last_login_date");
    if (!value) {
      return "İlk Giriş";
    }
    return new Date(value).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const lastRecordName = savedCases[0]?.name ?? "-";

  const barData = useMemo(() => {
    const now = new Date();
    const getDateStr = (c: SavedCase) => c.created_at || c.createdAt || "";
    const accountStart = getChartAccountStart(userInfo);

    if (period === "haftalik") {
      const getWeekStart = (d: Date) => {
        const day = d.getDay() || 7;
        const monday = new Date(d);
        monday.setDate(d.getDate() - day + 1);
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      };
      const keys: string[] = [];
      const counts: Record<string, number> = {};
      const accountWeekStart = accountStart
        ? (() => {
            const d = new Date(accountStart);
            const day = d.getDay() || 7;
            d.setDate(d.getDate() - day + 1);
            return getWeekStart(d);
          })()
        : null;
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(d.getDate() - 7 * i);
        const key = getWeekStart(d);
        if (accountWeekStart && key < accountWeekStart) {
          continue;
        }
        keys.push(key);
        counts[key] = 0;
      }
      savedCases.forEach((c) => {
        const source = getDateStr(c);
        if (!source) {
          return;
        }
        try {
          const key = getWeekStart(new Date(source));
          if (key in counts) {
            counts[key] += 1;
          }
        } catch {
          /* ignore invalid dates */
        }
      });
      if (keys.length === 0) {
        const key = getWeekStart(now);
        keys.push(key);
        counts[key] = 0;
      }
      return keys.map((key) => {
        const [, month, day] = key.split("-").map(Number);
        return { name: `${day}.${month}`, Adet: counts[key] };
      });
    }

    if (period === "yillik") {
      const year = now.getFullYear();
      const counts: Record<string, number> = {};
      for (let i = 6; i >= 0; i -= 1) {
        counts[String(year - i)] = 0;
      }
      savedCases.forEach((c) => {
        const source = getDateStr(c);
        if (!source) {
          return;
        }
        try {
          const key = String(new Date(source).getFullYear());
          if (key in counts) {
            counts[key] += 1;
          }
        } catch {
          /* ignore invalid dates */
        }
      });
      return Object.keys(counts)
        .sort()
        .map((key) => ({ name: key, Adet: counts[key] }));
    }

    if (period === "tum") {
      const map: Record<string, number> = {};
      savedCases.forEach((c) => {
        const source = getDateStr(c);
        if (!source) {
          return;
        }
        try {
          const d = new Date(source);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          map[key] = (map[key] || 0) + 1;
        } catch {
          /* ignore invalid dates */
        }
      });
      const sortedKeys = filterMonthKeysFromAccount(
        Object.keys(map).sort((a, b) => a.localeCompare(b)),
        userInfo,
      );
      return sortedKeys.slice(-12).map((key) => {
        const [, month] = key.split("-").map(Number);
        return { name: `${MONTHS[month - 1]} ${key.slice(0, 4)}`, Adet: map[key] };
      });
    }

    const months = buildMonthlyChartBuckets(now, userInfo);
    const counts: Record<string, number> = {};
    months.forEach(({ key }) => {
      counts[key] = 0;
    });
    savedCases.forEach((c) => {
      const source = getDateStr(c);
      if (!source) {
        return;
      }
      try {
        const d = new Date(source);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in counts) {
          counts[key] += 1;
        }
      } catch {
        /* ignore invalid dates */
      }
    });
    return months.map(({ key, month }) => ({ name: MONTHS[month], Adet: counts[key] }));
  }, [savedCases, period, userInfo]);

  const recentRows = useMemo(() => buildRecentRows(savedCases), [savedCases]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <RefreshCw className={styles.spin} size={28} />
        <span>Yükleniyor…</span>
      </div>
    );
  }

  const progressClass = styles[subscriptionProgressClass(sub.daysRemaining) as keyof typeof styles];
  const remainingClass = styles[subscriptionTextClass(sub.daysRemaining) as keyof typeof styles];

  return (
    <div className={styles.page}>
      <div className={styles.statGrid}>
        <div className={`${styles.card} ${styles.statCard}`}>
          <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
            <FileText size={20} />
          </div>
          <div>
            <p className={styles.statLabel}>Toplam Hesaplama</p>
            <p className={styles.statValue}>{num(savedCases.length)}</p>
          </div>
        </div>

        <div className={`${styles.card} ${styles.statCard}`}>
          <div className={`${styles.statIcon} ${styles.statIconViolet}`}>
            {avgProcessingTimeSec != null ? <Clock size={20} /> : <TrendingUp size={20} />}
          </div>
          <div>
            {avgProcessingTimeSec != null ? (
              <>
                <p className={styles.statLabel}>Ortalama İşlem Süresi</p>
                <p className={styles.statValue}>{formatAvgSeconds(avgProcessingTimeSec)}</p>
                <p className={styles.statHint}>Kayıtlı hesaplamalara göre</p>
              </>
            ) : (
              <>
                <p className={styles.statLabel}>Bu Ayki Hesaplama</p>
                <p className={styles.statValue}>{num(monthlyCalculationCount)}</p>
              </>
            )}
          </div>
        </div>

        <div className={`${styles.card} ${styles.statCard}`}>
          <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
            <Calendar size={20} />
          </div>
          <div>
            <p className={styles.statLabel}>Son Giriş</p>
            <p className={styles.statValue}>{lastLogin}</p>
          </div>
        </div>

        <div className={`${styles.card} ${styles.statCard}`}>
          <div className={`${styles.statIcon} ${styles.statIconOrange}`}>
            <Scale size={20} />
          </div>
          <div>
            <p className={styles.statLabel}>Son Kayıt</p>
            <p className={styles.statValue}>{lastRecordName}</p>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
              <TrendingUp size={16} />
            </div>
            <h2 className={styles.cardTitle}>Finansal Özet</h2>
            <p className={styles.cardDescription}>Abonelik ve lisans metrikleri</p>
          </div>
          <div className={styles.cardContent}>
            {financial ? (
              <div className={styles.metricGrid}>
              {[
                { label: "Aktif Abonelik", value: num(financial.activeSubscriptionCount) },
                { label: "Yıllık Plan", value: num(financial.annualPlanCount) },
                { label: "Aylık Plan", value: num(financial.monthlyPlanCount) },
                { label: "Ortalama Lisans Süresi", value: `${num(financial.averageLicenseDurationDays)} gün` },
                { label: "Demo Kullanıcı", value: num(financial.demoUserCount) },
                { label: "Demo → Satış %", value: `%${financial.demoToSaleConversionRate.toFixed(1)}` },
                { label: "Son 30 Gün Yeni", value: num(financial.newSubscriptionsLast30Days) },
                { label: "7 Gün İçinde Dolacak", value: num(financial.licensesExpiringIn7Days), warn: true },
              ].map(({ label, value, warn }) => (
                <div key={label} className={warn ? `${styles.metricBox} ${styles.metricBoxWarn}` : styles.metricBox}>
                  <p className={styles.metricLabel}>{label}</p>
                  <p className={warn ? `${styles.metricValue} ${styles.metricValueWarn}` : styles.metricValue}>{value}</p>
                </div>
              ))}
              {financial.hasPriceConfig && financial.estimatedMRR != null ? (
                <div className={styles.metricBox}>
                  <p className={styles.metricLabel}>Tahmini MRR</p>
                  <p className={styles.metricValue}>{num(financial.estimatedMRR)} ₺</p>
                </div>
              ) : null}
              </div>
            ) : (
              <div className={styles.empty}>
                {financialError ?? "Finansal özet verisi bulunamadı."}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
            <Calendar size={16} />
          </div>
          <h2 className={styles.cardTitle}>Abonelik Bilgileri</h2>
          <span className={planBadgeClass(subTypeLabel)}>{subTypeLabel}</span>
          <span className={sub.daysRemaining > 0 ? styles.badge : `${styles.badge} ${styles.badgeDanger}`}>
            {sub.daysRemaining > 0 ? (
              <>
                <CheckCircle2 size={12} />
                {sub.daysRemaining} gün kaldı
              </>
            ) : (
              <>
                <AlertCircle size={12} />
                Süresi doldu
              </>
            )}
          </span>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.dateGrid}>
            <div>
              <p className={styles.metricLabel}>Başlangıç Tarihi</p>
              <p className={styles.metricValue}>
                {sub.startDate
                  ? sub.startDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
                  : "-"}
              </p>
            </div>
            <div>
              <p className={styles.metricLabel}>Bitiş Tarihi</p>
              <p className={styles.metricValue}>
                {sub.endDate
                  ? sub.endDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
                  : "-"}
              </p>
            </div>
          </div>

          <div className={styles.miniStats}>
            {[
              { label: "Toplam Süre", value: sub.totalDays, unit: "gün", valueClass: styles.statValue },
              { label: "Kullanılan", value: sub.daysUsed, unit: "gün", valueClass: styles.statValue },
              { label: "Kalan", value: sub.daysRemaining, unit: "gün", valueClass: remainingClass },
              { label: "Kullanım", value: `%${sub.usedPct.toFixed(1)}`, unit: "tamamlandı", valueClass: styles.textIndigo },
            ].map(({ label, value, unit, valueClass }) => (
              <div key={label} className={styles.miniStat}>
                <p className={styles.metricLabel}>{label}</p>
                <p className={valueClass}>{value}</p>
                <p className={styles.metricLabel}>{unit}</p>
              </div>
            ))}
          </div>

          <div>
            <div className={styles.metricLabel}>
              <span>Abonelik İlerlemesi</span>
              <span className={styles.textGreen}>%{sub.remainingPct.toFixed(1)} kaldı</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={progressClass} style={{ width: `${sub.remainingPct}%` }} />
            </div>
            <p className={styles.metricLabel}>
              {!sub.hasSubscription
                ? "Abonelik bilgisi bulunamadı"
                : sub.daysRemaining > 0
                  ? `${sub.daysUsed} gün tamamlandı • ${sub.daysRemaining} gün kaldı`
                  : "Aboneliğinizin süresi doldu"}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Hesaplama Türlerine Göre Dağılım</h2>
          </div>
          <div className={styles.cardContent}>
            <CalculationTypeDistributionChart savedCases={savedCases} />
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Hesaplama Sayısı</h2>
            <select
              className={styles.periodSelect}
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              <option value="haftalik">Haftalık</option>
              <option value="aylik">Aylık</option>
              <option value="yillik">Yıllık</option>
              <option value="tum">Tümü</option>
            </select>
          </div>
          <div className={styles.cardContent}>
            {savedCases.length === 0 ? (
              <div className={styles.empty}>Henüz hesaplama kaydı yok</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -15, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" height={55} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ReTooltip contentStyle={{ fontSize: "12px" }} cursor={{ fill: "rgba(96,165,250,0.1)" }} />
                  <Bar dataKey="Adet" fill="#60A5FA" name="Hesaplama" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Son Kayıtlar</h2>
          <p className={styles.cardDescription}>En son yapılan hesaplamaların listesi</p>
        </div>
        <div className={styles.cardContent}>
          {recentRows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Tür</th>
                    <th className={styles.hiddenSm}>Kayıt Adı</th>
                    <th className={styles.hiddenMd}>Tarih</th>
                    <th>Brüt</th>
                    <th className={styles.hiddenSm}>Net</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((row, index) => (
                    <tr key={row.id ?? index}>
                      <td>{row.type}</td>
                      <td className={styles.hiddenSm}>{row.name || "-"}</td>
                      <td className={styles.hiddenMd}>{row.date}</td>
                      <td>{row.brut > 0 ? `₺${num(row.brut)}` : "-"}</td>
                      <td className={styles.hiddenSm}>{row.net > 0 ? `₺${num(row.net)}` : "-"}</td>
                      <td>
                        <button type="button" className={styles.detailButton} onClick={() => setDetailRow(row)}>
                          Detay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>Henüz kayıtlı hesaplama bulunmuyor.</div>
          )}
        </div>
      </div>

      {detailRow && (
        <div className={styles.modalOverlay} onClick={() => setDetailRow(null)} role="presentation">
          <div className={styles.modal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <h3 className={styles.cardTitle}>Kayıt Detayı</h3>
              <button type="button" className={styles.detailButton} onClick={() => setDetailRow(null)} aria-label="Kapat">
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalSection}>
                <p className={styles.metricLabel}>Temel Bilgiler</p>
                <div className={styles.dateGrid}>
                  <div>
                    <span className={styles.metricLabel}>Tür</span>
                    <p className={styles.metricValue}>{detailRow.type}</p>
                  </div>
                  <div>
                    <span className={styles.metricLabel}>Kayıt Adı</span>
                    <p className={styles.metricValue}>{detailRow.name || "-"}</p>
                  </div>
                  <div>
                    <span className={styles.metricLabel}>Tarih</span>
                    <p className={styles.metricValue}>{detailRow.date}</p>
                  </div>
                </div>
              </div>

              {detailRow.data && (
                <div className={`${styles.modalSection} ${styles.modalSectionBlue}`}>
                  <p className={styles.metricLabel}>Hesaplama Detayları</p>
                  <div className={styles.dateGrid}>
                    {Boolean(detailRow.data.iseGiris || detailRow.data.ise_giris) && (
                      <div>
                        <span className={styles.metricLabel}>İşe Giriş</span>
                        <p className={styles.metricValue}>
                          {new Date(String(detailRow.data.iseGiris ?? detailRow.data.ise_giris)).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                    )}
                    {Boolean(detailRow.data.istenCikis || detailRow.data.isten_cikis) && (
                      <div>
                        <span className={styles.metricLabel}>İşten Çıkış</span>
                        <p className={styles.metricValue}>
                          {new Date(String(detailRow.data.istenCikis ?? detailRow.data.isten_cikis)).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                    )}
                    {Boolean(detailRow.data.ucret || detailRow.data.brut || detailRow.data.brutUcret) && (
                      <div>
                        <span className={styles.metricLabel}>Brüt Ücret</span>
                        <p className={styles.metricValue}>
                          {num(Number(detailRow.data.ucret ?? detailRow.data.brut ?? detailRow.data.brutUcret))} ₺
                        </p>
                      </div>
                    )}
                    {Boolean(detailRow.data.calismaSuresi || detailRow.data.workPeriod) && (
                      <div>
                        <span className={styles.metricLabel}>Çalışma Süresi</span>
                        <p className={styles.metricValue}>
                          {String(detailRow.data.calismaSuresi ?? detailRow.data.workPeriod)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={`${styles.modalSection} ${styles.modalSectionGreen}`}>
                <p className={styles.metricLabel}>Sonuçlar</p>
                <div className={styles.dateGrid}>
                  <div>
                    <span className={styles.metricLabel}>Brüt Tutar</span>
                    <p className={styles.metricValue}>{detailRow.brut > 0 ? `₺${num(detailRow.brut)}` : "-"}</p>
                  </div>
                  <div>
                    <span className={styles.metricLabel}>Net Tutar</span>
                    <p className={`${styles.metricValue} ${styles.textGreen}`}>
                      {detailRow.net > 0 ? `₺${num(detailRow.net)}` : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.closeButton} onClick={() => setDetailRow(null)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
