import { apiClient } from "@/api/apiClient";

export type SavedCase = {
  id: number;
  name?: string;
  aciklama?: string;
  kayit_adi?: string;
  type: string;
  hesaplama_tipi?: string;
  data?: Record<string, unknown>;
  detay?: Record<string, unknown>;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  brut_total?: number;
  net_total?: number;
  brut_toplam?: number;
  net_toplam?: number;
};

export type DemoLicense = {
  expiresAt: string;
  createdAt: string;
  activatedAt: string;
  type: string;
};

export type UserInfo = {
  id: number;
  email: string;
  name?: string;
  subscriptionType?: string;
  subscriptionStartsAt?: string;
  subscriptionEndsAt?: string;
  status?: string;
  demoLicense?: DemoLicense;
};

export type FinancialSummary = {
  activeSubscriptionCount: number;
  annualPlanCount: number;
  monthlyPlanCount: number;
  averageLicenseDurationDays: number;
  demoUserCount: number;
  demoToSaleConversionRate: number;
  newSubscriptionsLast30Days: number;
  licensesExpiringIn7Days: number;
  estimatedMRR: number | null;
  hasPriceConfig: boolean;
};

export type DashboardData = {
  savedCases: SavedCase[];
  userInfo: UserInfo | null;
  financial: FinancialSummary | null;
  financialError: string | null;
};

function readCurrentUser(): { email?: string; role?: string; licenseType?: string } | null {
  try {
    return JSON.parse(localStorage.getItem("current_user") || "null") as {
      email?: string;
      role?: string;
      licenseType?: string;
    } | null;
  } catch {
    return null;
  }
}

export async function loadDashboardData(isAdmin: boolean): Promise<DashboardData> {
  let savedCases: SavedCase[] = [];
  try {
    const data = await apiClient<SavedCase[]>("/api/saved-cases");
    savedCases = Array.isArray(data) ? data : [];
  } catch {
    savedCases = [];
  }

  const currentUser = readCurrentUser();
  const emailRaw = localStorage.getItem("email") || currentUser?.email;

  let userInfo: UserInfo | null = null;
  if (emailRaw) {
    try {
      userInfo = await apiClient<UserInfo>(`/api/auth/me?email=${encodeURIComponent(emailRaw)}`);
    } catch {
      userInfo = null;
    }
  }

  let financial: FinancialSummary | null = null;
  let financialError: string | null = null;
  if (isAdmin) {
    try {
      financial = await apiClient<FinancialSummary>("/api/admin/financial-summary");
    } catch {
      financialError = "Finansal özet yüklenemedi. Yönetici oturumu ve API bağlantısını kontrol edin.";
    }
  }

  return {
    savedCases,
    userInfo,
    financial,
    financialError,
  };
}

export function readDashboardUserRole(): { isAdmin: boolean; currentUser: ReturnType<typeof readCurrentUser> } {
  const currentUser = readCurrentUser();
  const tenantId = Number(localStorage.getItem("tenant_id") || "1");
  const isAdmin = currentUser?.role === "admin" || tenantId === 1;
  return { isAdmin, currentUser };
}
