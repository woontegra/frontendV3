import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/context/ToastContext";
import { ArrowLeft } from "lucide-react";
import { apiClient } from "@/utils/apiClient";

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  barAssociationId: string;
  subscriptionType: string;
  subscriptionEndsAt: string;
}

interface BarAssociationOption {
  id: number;
  name: string;
}

export default function AdminCreateUserPage() {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [barAssociations, setBarAssociations] = useState<BarAssociationOption[]>([]);
  const [subscriptionType, setSubscriptionType] = useState("professional_annual");

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<CreateUserForm>({
    defaultValues: {
      role: "user",
      subscriptionType: "professional_annual",
      barAssociationId: "",
    },
  });

  useEffect(() => {
    fetchBarAssociations();
  }, []);

  useEffect(() => {
    const calculateEndDate = () => {
      const now = new Date();
      let endDate: Date;
      switch (subscriptionType) {
        case "demo_1day": endDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); break;
        case "demo_3days": endDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); break;
        case "demo_7days": endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); break;
        case "starter_monthly":
        case "professional_monthly": endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); break;
        case "professional_annual": endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); break;
        default: return;
      }
      setValue("subscriptionEndsAt", endDate.toISOString().split("T")[0]);
    };
    calculateEndDate();
  }, [subscriptionType, setValue]);

  const fetchBarAssociations = async () => {
    try {
      const res = await apiClient("/api/admin/bar-associations?status=ACTIVE", {
        headers: { "x-user-role": "admin" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBarAssociations(
          (Array.isArray(data.items) ? data.items : [])
            .map((item: { id?: number; name?: string }) => ({
              id: Number(item.id),
              name: String(item.name || "").trim(),
            }))
            .filter((item: BarAssociationOption) => Number.isFinite(item.id) && item.id > 0 && item.name),
        );
      }
    } catch {}
  };

  const onSubmit = async (data: CreateUserForm) => {
    try {
      setIsLoading(true);
      const res = await apiClient("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          subscriptionType: data.subscriptionType,
          subscriptionEndsAt: data.subscriptionEndsAt || null,
          barAssociationId: data.barAssociationId ? Number(data.barAssociationId) : null,
        }),
      });
      if (!res.ok) {
        if (res.status === 403) { error("Admin erişimi gerekli"); navigate("/admin-access-denied"); return; }
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "Kullanıcı oluşturulamadı");
      }
      const created = await res.json().catch(() => null);
      success("Kullanıcı başarıyla oluşturuldu");
      if (created?.id) {
        navigate(`/admin/users/${created.id}/detail`);
      } else {
        navigate("/admin/users");
      }
    } catch (err) {
      error(err instanceof Error ? err.message : "Kullanıcı oluşturulamadı");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Yeni Üyelik Aç</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Yeni bir kullanıcı oluşturun</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yeni Üyelik Aç</CardTitle>
          <CardDescription>Admin için hızlı kullanıcı ve abonelik oluşturma ekranı</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Her kullanıcı için ayrı bir çalışma alanı oluşturulur. Mevcut bir şirkete bağlama yapılmaz.
            </p>


            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Kullanıcı Bilgisi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Ad Soyad *</Label>
                <Input id="name" {...register("name", { required: "Ad soyad gereklidir" })} placeholder="Ad Soyad" />
                {errors.name && <p className="text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email", {
                    required: "Email gereklidir",
                    pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: "Geçerli bir email giriniz" },
                  })}
                  placeholder="email@example.com"
                />
                {errors.email && <p className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Parola *</Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password", { required: "Parola gereklidir", minLength: { value: 6, message: "En az 6 karakter" } })}
                  placeholder="En az 6 karakter"
                />
                {errors.password && <p className="text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rol *</Label>
                <Select id="role" {...register("role", { required: true })}>
                  <option value="user">Kullanıcı</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="barAssociationId">Baro (Opsiyonel)</Label>
                <Select id="barAssociationId" {...register("barAssociationId")}>
                  <option value="">Baro yok</option>
                  {barAssociations.map((bar) => (
                    <option key={bar.id} value={String(bar.id)}>
                      {bar.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Baro seçilirse müşteri kodu baro prefix&apos;i ile oluşturulur. Kampanya veya ödeme kaydı oluşturulmaz.
                </p>
              </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Abonelik Bilgisi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="subscriptionType">Abonelik Tipi *</Label>
                <Select
                  id="subscriptionType"
                  {...register("subscriptionType", { required: true })}
                  onChange={(e) => {
                    setValue("subscriptionType", e.target.value);
                    setSubscriptionType(e.target.value);
                  }}
                >
                  <option value="starter_monthly">Starter Aylık</option>
                  <option value="professional_monthly">Professional Aylık</option>
                  <option value="professional_annual">Professional Yıllık</option>
                  <optgroup label="Demo">
                    <option value="demo_1day">1 Günlük Demo</option>
                    <option value="demo_3days">3 Günlük Demo</option>
                    <option value="demo_7days">7 Günlük Demo</option>
                  </optgroup>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscriptionEndsAt">Abonelik Bitiş Tarihi</Label>
                <Input
                  id="subscriptionEndsAt"
                  type="date"
                  max="9999-12-31"
                  {...register("subscriptionEndsAt")}
                />
              </div>
              </div>
            </section>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link to="/admin/users"><Button type="button" variant="outline">İptal</Button></Link>
              <Button type="submit" disabled={isLoading}>{isLoading ? "Oluşturuluyor..." : "Kullanıcı Oluştur"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
