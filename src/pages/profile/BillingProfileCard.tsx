import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";

type BillingProfile = {
  invoiceType: "individual" | "corporate";
  fullName: string;
  email: string;
  phone: string;
  identityNumber: string;
  city: string;
  district: string;
  address: string;
  companyName: string;
  taxOffice: string;
  taxNumber: string;
  complete: boolean;
};

const emptyProfile: BillingProfile = {
  invoiceType: "individual",
  fullName: "",
  email: "",
  phone: "",
  identityNumber: "",
  city: "",
  district: "",
  address: "",
  companyName: "",
  taxOffice: "",
  taxNumber: "",
  complete: false,
};

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    "x-tenant-id": localStorage.getItem("tenant_id") || "1",
  };
}

function readProfile(payload: unknown): BillingProfile {
  const root = payload as { data?: { billingProfile?: Partial<BillingProfile> } };
  return {
    ...emptyProfile,
    ...root.data?.billingProfile,
  };
}

export default function BillingProfileCard() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [profile, setProfile] = useState<BillingProfile>({
    ...emptyProfile,
    email: user?.email || "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void apiClient("/api/user/billing-profile", { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error("Fatura bilgileri alınamadı.");
        const next = readProfile(await response.json());
        if (active) setProfile(next);
      })
      .catch(() => {
        if (active) {
          setProfile((current) => ({
            ...current,
            email: user?.email || current.email,
          }));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.email]);

  const set = (key: keyof BillingProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value, complete: false }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiClient("/api/user/billing-profile", {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Fatura bilgileri kaydedilemedi.");
      }
      setProfile(readProfile(payload));
      success("Fatura bilgileri kaydedildi");
    } catch (caught) {
      error(caught instanceof Error ? caught.message : "Fatura bilgileri kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fatura Bilgileri</CardTitle>
        <CardDescription>
          Satın alma ve abonelik yenilemelerinde kullanılacak bilgileri yönetin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-500">Fatura bilgileri yükleniyor...</p>
        ) : (
          <form onSubmit={save} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billingType">Fatura Tipi</Label>
                <select
                  id="billingType"
                  value={profile.invoiceType}
                  onChange={(event) => set("invoiceType", event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="individual">Bireysel</option>
                  <option value="corporate">Kurumsal</option>
                </select>
              </div>
              <Field label="Ad Soyad" value={profile.fullName} onChange={(value) => set("fullName", value)} required />
              <Field label="E-posta" value={profile.email} onChange={() => {}} readOnly />
              <Field label="Telefon" value={profile.phone} onChange={(value) => set("phone", value)} required />
              <Field label="T.C. Kimlik No (isteğe bağlı)" value={profile.identityNumber} onChange={(value) => set("identityNumber", value.replace(/\D/g, "").slice(0, 11))} />
              <Field label="İl" value={profile.city} onChange={(value) => set("city", value)} required />
              <Field label="İlçe" value={profile.district} onChange={(value) => set("district", value)} required />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billingAddress">Açık Adres</Label>
                <textarea
                  id="billingAddress"
                  value={profile.address}
                  onChange={(event) => set("address", event.target.value)}
                  required
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              {profile.invoiceType === "corporate" && (
                <>
                  <Field label="Firma Adı" value={profile.companyName} onChange={(value) => set("companyName", value)} required />
                  <Field label="Vergi Dairesi" value={profile.taxOffice} onChange={(value) => set("taxOffice", value)} required />
                  <Field label="Vergi No" value={profile.taxNumber} onChange={(value) => set("taxNumber", value.replace(/\D/g, "").slice(0, 11))} required />
                </>
              )}
            </div>
            {!profile.complete && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Otomatik ödeme akışı için zorunlu fatura bilgilerini tamamlayın.
              </p>
            )}
            <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
              <Button type="submit" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Fatura Bilgilerini Kaydet"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  readOnly?: boolean;
}) {
  const id = `billing-${label.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        readOnly={readOnly}
        className={readOnly ? "bg-gray-50 dark:bg-gray-900" : undefined}
      />
    </div>
  );
}
