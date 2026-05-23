import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";

function parseProfileUser(payload: Record<string, unknown>) {
  const nested = payload.data as Record<string, unknown> | undefined;
  const user = (nested?.user ?? payload) as Record<string, unknown>;
  return {
    id: typeof user.id === "number" ? user.id : undefined,
    name: typeof user.name === "string" ? user.name : "",
    email: typeof user.email === "string" ? user.email : "",
    phone: typeof user.phone === "string" ? user.phone : "",
    company: typeof user.company === "string" ? user.company : "",
    role: typeof user.role === "string" ? user.role : undefined,
  };
}

function profileAuthHeaders() {
  const token = localStorage.getItem("access_token");
  const tenantId = localStorage.getItem("tenant_id") || "1";
  return {
    "x-tenant-id": tenantId,
    Authorization: `Bearer ${token}`,
  };
}

function syncProfileToClient(
  profile: ReturnType<typeof parseProfileUser>,
  user: ReturnType<typeof useAuth>["user"],
  setUser: ReturnType<typeof useAuth>["setUser"],
) {
  setUser({
    ...user,
    id: profile.id ?? user?.id,
    name: profile.name,
    email: profile.email || user?.email,
    phone: profile.phone,
    company: profile.company,
  });
  const currentUser = JSON.parse(localStorage.getItem("current_user") || "{}");
  localStorage.setItem(
    "current_user",
    JSON.stringify({
      ...currentUser,
      id: profile.id ?? currentUser.id,
      name: profile.name,
      email: profile.email || currentUser.email,
      phone: profile.phone,
      company: profile.company,
      role: profile.role || user?.role || currentUser.role,
    }),
  );
  if (profile.email) {
    localStorage.setItem("email", profile.email);
  }
}

export default function ProfileInfoPage() {
  const { user, setUser } = useAuth();
  const { success, error } = useToast();
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    company: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      const currentUser = JSON.parse(localStorage.getItem("current_user") || "{}");
      setFormData({
        name: user?.name || currentUser.name || "",
        email: user?.email || currentUser.email || localStorage.getItem("email") || "",
        phone: (user as { phone?: string })?.phone || currentUser.phone || "",
        company: (user as { company?: string })?.company || currentUser.company || "",
      });
      return;
    }

    const loadUserData = async () => {
      try {
        const response = await apiClient("/api/user/profile", {
          headers: profileAuthHeaders(),
        });
        if (response.ok) {
          const payload = await response.json();
          const profile = parseProfileUser(payload);
          setFormData({
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            company: profile.company,
          });
          syncProfileToClient(profile, user, setUser);
        } else {
          const currentUser = JSON.parse(localStorage.getItem("current_user") || "{}");
          setFormData({
            name: user?.name || currentUser.name || "",
            email: user?.email || currentUser.email || localStorage.getItem("email") || "",
            phone: (user as { phone?: string })?.phone || currentUser.phone || "",
            company: (user as { company?: string })?.company || currentUser.company || "",
          });
        }
      } catch {
        const currentUser = JSON.parse(localStorage.getItem("current_user") || "{}");
        setFormData({
          name: user?.name || currentUser.name || "",
          email: user?.email || currentUser.email || localStorage.getItem("email") || "",
          phone: (user as { phone?: string })?.phone || currentUser.phone || "",
          company: (user as { company?: string })?.company || currentUser.company || "",
        });
      }
    };
    loadUserData();
  }, [user?.email]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      error("Ad Soyad alanı zorunludur.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiClient("/api/user/profile", {
        method: "PUT",
        headers: {
          ...profileAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          company: formData.company,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Profil güncellenirken bir hata oluştu");
      }
      const payload = await response.json();
      const profile = parseProfileUser(payload);
      syncProfileToClient(profile, user, setUser);
      setFormData({
        name: profile.name,
        email: profile.email || formData.email,
        phone: profile.phone || "",
        company: profile.company || "",
      });
      success("Profil bilgileri başarıyla güncellendi");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Profil güncellenirken bir hata oluştu";
      error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
            ℹ
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Profil Resmi Nasıl Yüklenir?</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Profil resminizi yüklemek için sayfanın en üstündeki avatar resminize tıklayın.
            </p>
          </div>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profil Bilgileri</CardTitle>
          <CardDescription>Kişisel bilgilerinizi güncelleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Ad Soyad</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Adınız ve soyadınız"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  readOnly
                  placeholder="ornek@email.com"
                  className="bg-gray-50 dark:bg-gray-900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+90 555 123 45 67"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Firma Adı</Label>
                <Input
                  id="company"
                  name="company"
                  type="text"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Firma adı"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
