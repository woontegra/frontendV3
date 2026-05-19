import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Shield, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "@/auth/authToken";
import { persistV3Session } from "@/auth/session";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("remember_email");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const baroTrackingToken = new URLSearchParams(location.search).get("bt") || "";
      const data = await login(email.trim(), password, baroTrackingToken);

      persistV3Session(data.user.email);
      window.dispatchEvent(new Event("auth-changed"));

      if (rememberMe) {
        localStorage.setItem("remember_email", email.trim());
      } else {
        localStorage.removeItem("remember_email");
      }

      localStorage.setItem("last_login_date", new Date().toISOString());

      if (data.requirePasswordChange === true) {
        navigate("/change-password", { replace: true });
        return;
      }

      const tenantId = Number(localStorage.getItem("tenant_id") || "1");
      const licenseValid = localStorage.getItem("licenseValid") === "true";
      const licenseType = (data.licenseType || "").toLowerCase();
      const isDemoUser = licenseType === "demo";

      if (tenantId === 1) {
        navigate("/dashboard", { replace: true });
        return;
      }

      if (!licenseValid && !isDemoUser) {
        navigate("/professional-license-activation", { replace: true });
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.gridOverlay} aria-hidden />

      <div className={styles.centerWrap}>
        <div className={styles.cardOuter}>
          <div className={styles.cardGlow} aria-hidden />

          <div className={styles.cardInner}>
            <span className={styles.versionBadge}>v3</span>

            <div className={styles.header}>
              <img
                src="/logo_beyaz.png"
                alt="Bilirkişi Hesaplama"
                className={styles.logo}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <h1 className={styles.title}>Bilirkişi Hesaplama</h1>
              <p className={styles.subtitle}>
                <Shield className={styles.subtitleIcon} aria-hidden />
                Oturum açın
              </p>
            </div>

            <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="login-email">
                  <Sparkles className={styles.fieldIconAmber} aria-hidden />
                  E-Posta
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={styles.fieldInput}
                  placeholder="ornek@email.com"
                  autoComplete="username"
                  required
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="login-password">
                  <Lock className={styles.fieldIconViolet} aria-hidden />
                  Şifre
                </label>
                <div className={styles.passwordWrap}>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={styles.fieldInput}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPassword((value) => !value)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showPassword ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
                  </button>
                </div>
              </div>

              <div className={styles.formRow}>
                <label className={styles.rememberLabel}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className={styles.checkbox}
                  />
                  <span>Beni Hatırla</span>
                </label>
                <Link to="/forgot-password" className={styles.forgotLink}>
                  Şifremi unuttum
                </Link>
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}

              <button type="submit" className={styles.submitButton} disabled={loading}>
                <span className={styles.submitGradient} aria-hidden />
                <span className={styles.submitInner}>
                  {loading ? (
                    <>
                      <span className={styles.spinner} aria-hidden />
                      Giriş yapılıyor...
                    </>
                  ) : (
                    <>
                      <Shield size={16} aria-hidden />
                      GİRİŞ YAP
                    </>
                  )}
                </span>
              </button>
            </form>

            <div className={styles.footer}>
              <span className={styles.statusDot} aria-hidden />
              <span>Sistem Aktif · Sürüm 3.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
