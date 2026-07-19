import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { apiGet } from "@/utils/apiClient";
import { useToast } from "@/context/ToastContext";
import {
  cardDescriptionCls,
  cardTitleCls,
  pageSubtitleCls,
  pageTitleCls,
  tableHeadCompactCls,
} from "./adminStyles";

interface BarPerformance {
  barAssociationKey: string;
  barAssociationName: string;
  uniqueUserCount: number;
  firstPurchaseCount: number;
  renewalCount: number;
  totalAmountKurus: number;
  lastPurchaseAt: string | null;
}

interface CampaignUser {
  userId: number;
  name: string;
  email: string;
  sourceAt: string | null;
  firstPurchaseCount: number;
  renewalCount: number;
  totalAmountKurus: number;
  lastPurchaseAt: string | null;
}

const moneyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

function formatAmount(kurus: number) {
  return moneyFormatter.format(kurus / 100);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminBarCampaignPerformancePage() {
  const { error } = useToast();
  const [includeTest, setIncludeTest] = useState(false);
  const [bars, setBars] = useState<BarPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBar, setSelectedBar] = useState<BarPerformance | null>(null);
  const [users, setUsers] = useState<CampaignUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const loadBars = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet(
        `/api/admin/bar-campaign-performance?includeTest=${includeTest}`,
      );
      const payload = await response.json();
      if (!response.ok || payload.success !== true) {
        throw new Error(payload.message || "Performans verileri yüklenemedi.");
      }
      setBars(Array.isArray(payload.bars) ? payload.bars : []);
      setSelectedBar(null);
      setUsers([]);
    } catch (requestError) {
      error(
        requestError instanceof Error
          ? requestError.message
          : "Performans verileri yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, [error, includeTest]);

  useEffect(() => {
    void loadBars();
  }, [loadBars]);

  const loadUsers = async (bar: BarPerformance) => {
    setSelectedBar(bar);
    setUsersLoading(true);
    try {
      const response = await apiGet(
        `/api/admin/bar-campaign-performance/${encodeURIComponent(bar.barAssociationKey)}/users?includeTest=${includeTest}`,
      );
      const payload = await response.json();
      if (!response.ok || payload.success !== true) {
        throw new Error(payload.message || "Kampanya kullanıcıları yüklenemedi.");
      }
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (requestError) {
      setUsers([]);
      error(
        requestError instanceof Error
          ? requestError.message
          : "Kampanya kullanıcıları yüklenemedi.",
      );
    } finally {
      setUsersLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-full space-y-4 px-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitleCls}>Baro Kampanya Performansı</h1>
          <p className={pageSubtitleCls}>
            APPLIED satın alma ve yenilemelerin baro bazlı performansını görüntüleyin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(event) => setIncludeTest(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Test işlemlerini göster
          </label>
          <button
            type="button"
            onClick={() => void loadBars()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className={cardTitleCls}>Baro Özeti</CardTitle>
          <CardDescription className={cardDescriptionCls}>
            Benzersiz kullanıcı sayısı aynı kullanıcının tekrar siparişlerini tekilleştirir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : bars.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Kampanyaya bağlı başarılı işlem bulunamadı.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                    <th className={`text-left ${tableHeadCompactCls}`}>Baro</th>
                    <th className={`text-center ${tableHeadCompactCls}`}>Benzersiz Kullanıcı</th>
                    <th className={`text-center ${tableHeadCompactCls}`}>İlk Satın Alma</th>
                    <th className={`text-center ${tableHeadCompactCls}`}>Yenileme</th>
                    <th className={`text-right ${tableHeadCompactCls}`}>Toplam Tahsilat</th>
                    <th className={`text-left ${tableHeadCompactCls}`}>Son Satın Alma</th>
                  </tr>
                </thead>
                <tbody>
                  {bars.map((bar) => (
                    <tr
                      key={bar.barAssociationKey}
                      onClick={() => void loadUsers(bar)}
                      className="cursor-pointer border-b transition-colors hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-950/20"
                    >
                      <td className="px-3 py-2.5 text-sm font-medium">{bar.barAssociationName}</td>
                      <td className="px-3 py-2.5 text-center text-sm">{bar.uniqueUserCount}</td>
                      <td className="px-3 py-2.5 text-center text-sm">{bar.firstPurchaseCount}</td>
                      <td className="px-3 py-2.5 text-center text-sm">{bar.renewalCount}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-medium">
                        {formatAmount(bar.totalAmountKurus)}
                      </td>
                      <td className="px-3 py-2.5 text-sm">{formatDate(bar.lastPurchaseAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedBar && (
        <Card>
          <CardHeader>
            <CardTitle className={`${cardTitleCls} flex items-center gap-2`}>
              <Users className="h-4 w-4" />
              {selectedBar.barAssociationName} Kullanıcıları
            </CardTitle>
            <CardDescription className={cardDescriptionCls}>
              Kampanya üzerinden APPLIED işlemi bulunan benzersiz kullanıcılar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                      <th className={`text-left ${tableHeadCompactCls}`}>Kullanıcı</th>
                      <th className={`text-left ${tableHeadCompactCls}`}>E-posta</th>
                      <th className={`text-center ${tableHeadCompactCls}`}>İlk Satın Alma</th>
                      <th className={`text-center ${tableHeadCompactCls}`}>Yenileme</th>
                      <th className={`text-right ${tableHeadCompactCls}`}>Toplam</th>
                      <th className={`text-left ${tableHeadCompactCls}`}>Son İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.userId} className="border-b dark:border-gray-800">
                        <td className="px-3 py-2.5 text-sm font-medium">{user.name}</td>
                        <td className="px-3 py-2.5 text-sm">{user.email}</td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="secondary">{user.firstPurchaseCount}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="secondary">{user.renewalCount}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm">
                          {formatAmount(user.totalAmountKurus)}
                        </td>
                        <td className="px-3 py-2.5 text-sm">{formatDate(user.lastPurchaseAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
