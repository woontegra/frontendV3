import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  Tag,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";
import { calculateSubscription } from "@/utils/subscriptionUtils";
import {
  formatProductType,
  getOptionPricing,
  normalizeRenewalOptions,
  parseRenewalRedirect,
  type RenewalOption,
  type RenewalOptions,
} from "./subscriptionRenewal";

const renewalEnabled = import.meta.env.VITE_SUBSCRIPTION_RENEWAL_ENABLED === "true";
const CUSTOMER_RENEWAL_URL = "https://bilirkisihesap.com/abonelik-yenile";
const PURCHASE_URL = "https://bilirkisihesap.com/satin-al";

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) return "-";
  const normalizedCurrency = currency.toUpperCase() === "TL" ? "TRY" : currency.toUpperCase();
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  }
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  const message = body?.message ?? body?.error ?? body?.details;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function buildCustomerRenewalUrl(customerCode: string) {
  const url = new URL(CUSTOMER_RENEWAL_URL);
  url.searchParams.set("customer", customerCode);
  return url.toString();
}

export function subscriptionExpiryWarningThreshold(productType: string | null) {
  const normalized = String(productType || "").trim().toLowerCase();
  if (["monthly", "professional_monthly", "pro_monthly"].includes(normalized)) {
    return 7;
  }
  if (["annual", "yearly", "professional_yearly", "pro_yearly"].includes(normalized)) {
    return 30;
  }
  return null;
}

function CustomerNumberActions({
  customerCode,
  onRenew,
  renewalDisabled = false,
  renewalLoading = false,
  actionRequiresCustomerCode = true,
  actionLabel = "Aboneliği Uzat",
}: {
  customerCode?: string;
  onRenew?: () => void;
  renewalDisabled?: boolean;
  renewalLoading?: boolean;
  actionRequiresCustomerCode?: boolean;
  actionLabel?: string;
}) {
  const { success, error } = useToast();

  const copyCustomerCode = async () => {
    if (!customerCode) return;

    try {
      await navigator.clipboard.writeText(customerCode);
      success("Müşteri numaranız kopyalandı.");
    } catch {
      error("Müşteri numarası kopyalanamadı.");
    }
  };

  const openRenewalPage = () => {
    if (!customerCode) return;
    window.open(
      buildCustomerRenewalUrl(customerCode),
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Müşteri Numaranız</CardTitle>
        <CardDescription>
          Abonelik işlemlerinizde bu kodu kullanabilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-2xl font-bold tracking-wide text-gray-900 dark:text-gray-100">
          {customerCode ?? "-"}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyCustomerCode()}
            disabled={!customerCode}
          >
            <Copy aria-hidden="true" className="mr-2 h-4 w-4" />
            Kopyala
          </Button>
          <Button
            type="button"
            onClick={onRenew ?? openRenewalPage}
            disabled={(actionRequiresCustomerCode && !customerCode) || renewalDisabled || renewalLoading}
          >
            <ExternalLink aria-hidden="true" className="mr-2 h-4 w-4" />
            {renewalLoading ? "Hazırlanıyor..." : actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface LegacySubscriptionData {
  subscriptionType: string | null;
  subscriptionEndsAt: string | null;
  subscriptionStartsAt?: string | null;
  autoRenew: boolean;
}

interface DemoSubscriptionData {
  startsAt: string | null;
  endsAt: string | null;
  licenseActive: boolean;
  licenseStatus: string | null;
}

function DemoSubscriptionPage({ userKey }: { userKey: string | null }) {
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState<DemoSubscriptionData | null>(null);

  useEffect(() => {
    let active = true;
    const loadDemo = async () => {
      setLoading(true);
      try {
        const response = await apiClient("/api/auth/me");
        if (!response.ok) throw new Error("DEMO_INFO_UNAVAILABLE");
        const payload = await response.json() as Record<string, unknown>;
        const demoLicense =
          payload.demoLicense && typeof payload.demoLicense === "object"
            ? payload.demoLicense as Record<string, unknown>
            : null;
        const stringOrNull = (value: unknown) =>
          typeof value === "string" && value.trim() ? value : null;
        if (active) {
          setDemo({
            startsAt:
              stringOrNull(payload.subscriptionStartsAt)
              ?? stringOrNull(demoLicense?.activatedAt)
              ?? stringOrNull(demoLicense?.createdAt),
            endsAt:
              stringOrNull(payload.subscriptionEndsAt)
              ?? stringOrNull(demoLicense?.expiresAt),
            licenseActive: payload.licenseActive !== false,
            licenseStatus: stringOrNull(payload.licenseStatus),
          });
        }
      } catch {
        if (active) setDemo(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDemo();
    return () => {
      active = false;
    };
  }, [userKey]);

  const progress = calculateSubscription(demo?.startsAt, demo?.endsAt);
  const remainingDays = progress.hasSubscription
    ? Math.max(0, progress.daysRemaining)
    : 0;
  const expired =
    demo?.licenseStatus === "EXPIRED"
    || !demo?.licenseActive
    || (progress.hasSubscription && progress.daysRemaining <= 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Abonelik Bilgileri</CardTitle>
        <CardDescription>7 günlük demo erişiminizin durumu</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div aria-busy="true" className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item}>
                <div className="mb-2 h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-6 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
          </div>
        ) : demo ? (
          <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Durum</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                7 Günlük Demo
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Demo Başlangıç Tarihi</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatDate(demo.startsAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Demo Bitiş Tarihi</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatDate(demo.endsAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Kalan Gün</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {remainingDays} gün
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Hesap Durumu</dt>
              <dd className={`mt-1 text-lg font-semibold ${expired ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                {expired ? "Süresi dolmuş" : "Aktif"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Demo erişim bilgileri şu anda görüntülenemiyor.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LegacySubscriptionPage() {
  const { user } = useAuth();
  const { error } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<LegacySubscriptionData | null>(null);

  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    const loadSubscriptionData = async () => {
      if (!user?.email) return;
      try {
        setLoading(true);
        const email = encodeURIComponent(user.email);
        const response = await apiClient(`/api/auth/me?email=${email}`, {
          headers: { "x-tenant-id": String(tenantId), Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Abonelik bilgileri yüklenemedi");
        const data = await response.json();
        setSubscriptionData({
          subscriptionType: data.subscriptionType || null,
          subscriptionEndsAt: data.subscriptionEndsAt || null,
          subscriptionStartsAt: data.subscriptionStartsAt || null,
          autoRenew: data.autoRenew || false,
        });
      } catch {
        error("Abonelik bilgileri yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    void loadSubscriptionData();
  }, [user?.email]);

  const legacyFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return String(dateStr);
    }
  };

  const getSubscriptionTypeLabel = (type: string | null) => {
    if (!type) return "Abonelik Yok";
    const labels: Record<string, string> = {
      starter: "Starter",
      professional: "Professional",
      demo: "Demo",
      annual: "Yıllık Standart",
      monthly: "Aylık Standart",
      trial: "Deneme",
      premium: "Professional",
    };
    return labels[type] || type;
  };

  const getProgress = () => {
    const calc = calculateSubscription(
      subscriptionData?.subscriptionStartsAt,
      subscriptionData?.subscriptionEndsAt,
    );
    if (!calc.hasSubscription)
      return { daysRemaining: null, percentage: 0, totalDays: 0, elapsedDays: 0 };
    return {
      daysRemaining: calc.daysRemaining > 0 ? calc.daysRemaining : 0,
      percentage: calc.remainingPct,
      totalDays: calc.totalDays,
      elapsedDays: calc.daysUsed,
    };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Abonelik Bilgileri</CardTitle>
          <CardDescription>Mevcut abonelik planınız</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                  <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm text-gray-500">Abonelik Tipi</Label>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {user?.licenseType
                      ? getSubscriptionTypeLabel(user.licenseType)
                      : subscriptionData
                        ? getSubscriptionTypeLabel(subscriptionData.subscriptionType)
                        : "Abonelik Yok"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Başlangıç Tarihi</Label>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {subscriptionData?.subscriptionStartsAt
                      ? legacyFormatDate(subscriptionData.subscriptionStartsAt)
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Bitiş Tarihi</Label>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {subscriptionData?.subscriptionEndsAt
                      ? legacyFormatDate(subscriptionData.subscriptionEndsAt)
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Yenileme Tarihi</Label>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {subscriptionData?.subscriptionEndsAt
                      ? legacyFormatDate(subscriptionData.subscriptionEndsAt)
                      : "-"}
                  </p>
                </div>
              </div>

              {subscriptionData?.subscriptionEndsAt &&
                (() => {
                  const progress = getProgress();
                  if (progress.daysRemaining === null) return null;
                  const isExpiringSoon = progress.daysRemaining <= 30;
                  const isExpired = progress.daysRemaining <= 0;
                  const remaining = progress.percentage;
                  const elapsed = 100 - remaining;
                  return (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm text-gray-500">
                          {isExpired
                            ? "Abonelik Süresi Doldu"
                            : `Kalan Süre: ${progress.daysRemaining} gün`}
                        </Label>
                        <span
                          className={`text-sm font-semibold ${
                            isExpired || isExpiringSoon ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {remaining.toFixed(1)}% kaldı
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden relative">
                        {elapsed > 0 && (
                          <div
                            className="h-full bg-gray-400 absolute left-0 top-0 transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, elapsed))}%` }}
                          />
                        )}
                        {remaining > 0 && (
                          <div
                            className={`h-full absolute right-0 top-0 transition-all ${
                              isExpired || isExpiringSoon ? "bg-red-500" : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, remaining))}%` }}
                          />
                        )}
                      </div>
                      {progress.daysRemaining > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {progress.elapsedDays} gün geçti, {progress.daysRemaining} gün kaldı
                        </p>
                      )}
                    </div>
                  );
                })()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RenewalSubscriptionPage({
  userKey,
  onSelectionChange,
}: {
  userKey: string | null;
  onSelectionChange: (option: RenewalOption | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renewal, setRenewal] = useState<RenewalOptions | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const loadRenewalOptions = async () => {
      setLoading(true);
      setLoadError(null);
      setRenewal(null);
      setSelectedIndex(0);
      try {
        const response = await apiClient("/api/subscription/renewal/options", { method: "GET" });
        if (!response.ok) {
          throw new Error(await responseError(response, "Abonelik ve yenileme bilgileri yüklenemedi."));
        }
        const parsed = normalizeRenewalOptions(await response.json());
        if (active) {
          setRenewal(parsed);
          setSelectedIndex(0);
        }
      } catch (requestError) {
        if (active) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : "Abonelik ve yenileme bilgileri yüklenemedi.";
          setLoadError(message);
          setRenewal(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadRenewalOptions();
    return () => {
      active = false;
    };
  }, [reloadKey, userKey]);

  const selectedOption = renewal?.options[selectedIndex] ?? null;
  useEffect(() => {
    onSelectionChange(selectedOption);
  }, [onSelectionChange, selectedOption]);
  const pricing = useMemo(
    () => (renewal ? getOptionPricing(renewal, selectedOption) : null),
    [renewal, selectedOption],
  );
  const selectedCampaign = selectedOption ? selectedOption.campaign : renewal?.campaign ?? null;

  const warningThreshold = subscriptionExpiryWarningThreshold(
    renewal?.currentPackage ?? null,
  );
  const isExpired =
    renewal?.remainingDays !== null
    && renewal?.remainingDays !== undefined
    && renewal.remainingDays <= 0;
  const expiringSoon =
    isExpired
    || (
      warningThreshold !== null
      && renewal?.remainingDays !== null
      && renewal?.remainingDays !== undefined
      && renewal.remainingDays <= warningThreshold
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Abonelik Bilgileri</CardTitle>
          <CardDescription>Mevcut paketiniz ve yenileme seçenekleriniz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div aria-busy="true" aria-label="Abonelik bilgileri yükleniyor" className="space-y-6">
              <span className="sr-only">Abonelik bilgileri yükleniyor.</span>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item}>
                    <div className="mb-2 h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
              <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            </div>
          ) : loadError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" className="mb-2 h-5 w-5" />
              <AlertTitle>Bilgiler yüklenemedi</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{loadError}</p>
                <Button variant="outline" size="sm" onClick={() => setReloadKey((value) => value + 1)}>
                  <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
                  Tekrar Dene
                </Button>
              </AlertDescription>
            </Alert>
          ) : renewal ? (
            <>
              {expiringSoon && (
                <Alert variant="warning" className="border-2 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-100">
                  <AlertCircle aria-hidden="true" className="mb-2 h-6 w-6" />
                  <AlertTitle className="text-base">Abonelik süreniz yakında sona eriyor</AlertTitle>
                  <AlertDescription>
                    {renewal.remainingDays !== null && renewal.remainingDays <= 0
                      ? "Backend bilgisine göre abonelik süreniz sona ermiş."
                      : `Aboneliğinizin bitmesine ${renewal.remainingDays} gün kaldı.`}
                  </AlertDescription>
                </Alert>
              )}

              <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Mevcut Paket</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {renewal.currentPackage
                      ? formatProductType(renewal.currentPackage)
                      : "Paket bilgisi yok"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Lisans Bitiş Tarihi</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {formatDate(renewal.licenseEnd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Kalan Süre</dt>
                  <dd className={`mt-1 text-lg font-semibold ${expiringSoon ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
                    {renewal.remainingDays === null ? "-" : `${renewal.remainingDays} gün`}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Bağlı Baro</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {renewal.linkedBaro ?? "Bağlı baro yok"}
                  </dd>
                </div>
              </dl>

              <section aria-labelledby="campaign-title" className="border-t border-gray-200 pt-6 dark:border-gray-700">
                <div className="mb-4 flex items-center gap-2">
                  <Tag aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h2 id="campaign-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Yenileme Fiyatı
                  </h2>
                </div>
                {selectedCampaign ? (
                  <Alert variant="success" className="mb-5 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
                    <CheckCircle2 aria-hidden="true" className="mb-2 h-5 w-5" />
                    <AlertTitle>{selectedCampaign.name ?? "Aktif yenileme kampanyası"}</AlertTitle>
                    <AlertDescription>
                      <p>Bu kampanya backend tarafından şu anda geçerli olarak bildirildi.</p>
                      {(selectedCampaign.startsAt || selectedCampaign.endsAt) && (
                        <p className="mt-1 flex flex-wrap items-center gap-1">
                          <CalendarDays aria-hidden="true" className="h-4 w-4" />
                          <span>
                            {formatDate(selectedCampaign.startsAt)} – {formatDate(selectedCampaign.endsAt)}
                          </span>
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="mb-5 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                    <AlertTitle>Aktif yenileme kampanyası yok</AlertTitle>
                    <AlertDescription>
                      Kampanya geçerli olmadığında normal fiyat uygulanır.
                    </AlertDescription>
                  </Alert>
                )}

                {renewal.options.length > 0 ? (
                  <div className="mb-5 max-w-xl space-y-2">
                    <Label htmlFor="renewal-option">Paket ve süre seçimi</Label>
                    <Select
                      id="renewal-option"
                      value={String(selectedIndex)}
                      onChange={(event) => setSelectedIndex(Number(event.target.value))}
                    >
                      {renewal.options.map((option, index) => (
                        <option key={`${option.productType}-${String(option.period)}`} value={index}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Yalnızca backend tarafından izin verilen seçenekler gösterilir.
                    </p>
                  </div>
                ) : (
                  <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">
                    Backend tarafından kullanılabilir paket veya dönem seçeneği bildirilmedi.
                  </p>
                )}

                {pricing && (
                  <dl aria-live="polite" className="grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-3 dark:bg-gray-800/70">
                    <div>
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Normal Fiyat</dt>
                      <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {formatMoney(pricing.normalPrice, pricing.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Kampanya İndirimi</dt>
                      <dd className="mt-1 text-lg font-semibold text-green-700 dark:text-green-400">
                        {selectedCampaign
                          ? pricing.discountPercent !== null
                            ? `%${pricing.discountPercent}`
                            : pricing.discountAmount !== null
                              ? `-${formatMoney(pricing.discountAmount, pricing.currency)}`
                              : "-"
                          : "Uygulanmıyor"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Ödenecek Tutar</dt>
                      <dd className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-400">
                        {formatMoney(
                          selectedCampaign
                            ? pricing.finalAmount ?? pricing.normalPrice
                            : pricing.normalPrice ?? pricing.finalAmount,
                          pricing.currency,
                        )}
                      </dd>
                    </div>
                  </dl>
                )}

                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {selectedCampaign
                    ? "Kampanya geçerliliği ve tutarlar backend yanıtına göre gösterilir."
                    : "Aktif kampanya olmadığından normal fiyat esas alınır."}
                </p>
              </section>

              {renewal.message && (
                <p className="text-sm text-gray-600 dark:text-gray-300">{renewal.message}</p>
              )}

            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SubscriptionPage() {
  const { user, refreshUser } = useAuth();
  const { error } = useToast();
  const refreshedUserId = useRef<string | null>(null);
  const [selectedRenewalOption, setSelectedRenewalOption] = useState<RenewalOption | null>(null);
  const [renewalStarting, setRenewalStarting] = useState(false);
  const isDemo = user?.licenseType?.toLowerCase() === "demo";

  useEffect(() => {
    const userId = user?.id == null ? null : String(user.id);
    if (!userId || user.customerCode || refreshedUserId.current === userId) return;
    refreshedUserId.current = userId;
    void refreshUser();
  }, [refreshUser, user?.customerCode, user?.id]);

  const startSelectedRenewal = useCallback(async () => {
    if (!selectedRenewalOption || renewalStarting) return;
    setRenewalStarting(true);
    try {
      const response = await apiClient("/api/subscription/renewal/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: selectedRenewalOption.productType,
          period: selectedRenewalOption.period,
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Yenileme oturumu oluşturulamadı."));
      }
      const renewalUrl = parseRenewalRedirect(await response.json());
      window.open(renewalUrl, "_blank", "noopener,noreferrer");
    } catch (requestError) {
      error(
        requestError instanceof Error
          ? requestError.message
          : "Yenileme oturumu oluşturulamadı.",
      );
    } finally {
      setRenewalStarting(false);
    }
  }, [error, renewalStarting, selectedRenewalOption]);

  return (
    <div className="space-y-6">
      <CustomerNumberActions
        customerCode={user?.customerCode}
        onRenew={
          isDemo
            ? () => window.open(PURCHASE_URL, "_blank", "noopener,noreferrer")
            : renewalEnabled
              ? () => void startSelectedRenewal()
              : undefined
        }
        renewalDisabled={!isDemo && renewalEnabled && !selectedRenewalOption}
        renewalLoading={!isDemo && renewalStarting}
        actionRequiresCustomerCode={!isDemo}
        actionLabel={isDemo ? "Abonelik Satın Al" : "Aboneliği Uzat"}
      />
      {isDemo ? (
        <DemoSubscriptionPage userKey={user?.id == null ? null : String(user.id)} />
      ) : renewalEnabled ? (
        <RenewalSubscriptionPage
          userKey={user?.id == null ? null : String(user.id)}
          onSelectionChange={setSelectedRenewalOption}
        />
      ) : (
        <LegacySubscriptionPage />
      )}
    </div>
  );
}
