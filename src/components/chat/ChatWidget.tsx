import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Headphones, MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient, API_BASE_URL } from "@/utils/apiClient";
import { isAdminRole } from "@/shared/utils/profilePicture";
import styles from "./ChatWidget.module.css";

const POLL_INTERVAL = 5000;

const OFFLINE_TOPICS = [
  "Demo hesabım hakkında bilgi almak istiyorum",
  "Hesaplama ekranları hakkında sorum var",
  "Üyelik / abonelik hakkında bilgi almak istiyorum",
  "Teknik destek almak istiyorum",
  "Diğer",
] as const;

interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: number;
  message: string;
  imageUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

type SubmitState = "idle" | "success" | "error";
type PresenceMode = "loading" | "online" | "offline";

function readStoredUser(): { name: string; email: string } {
  try {
    const raw = localStorage.getItem("current_user");
    if (!raw) {
      return { name: "", email: localStorage.getItem("email") || "" };
    }
    const parsed = JSON.parse(raw) as { name?: string; email?: string };
    return {
      name: (parsed.name || "").trim(),
      email: (parsed.email || localStorage.getItem("email") || "").trim(),
    };
  } catch {
    return { name: "", email: localStorage.getItem("email") || "" };
  }
}

function computeWidgetAccess(): { show: boolean; token: string | null } {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return { show: false, token: null };
  }

  try {
    const current = JSON.parse(localStorage.getItem("current_user") || "null") as {
      role?: string;
      tenantId?: number;
    } | null;
    const tenantId = Number(current?.tenantId ?? localStorage.getItem("tenant_id") ?? "1");
    if (isAdminRole(current?.role, tenantId)) {
      return { show: false, token };
    }
  } catch {
    /* giriş yapmış normal kullanıcı */
  }

  return { show: true, token };
}

export default function ChatWidget() {
  const [authTick, setAuthTick] = useState(0);
  const access = useMemo(() => computeWidgetAccess(), [authTick]);

  const [open, setOpen] = useState(false);
  const [presenceMode, setPresenceMode] = useState<PresenceMode>("loading");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [offlineName, setOfflineName] = useState("");
  const [offlineEmail, setOfflineEmail] = useState("");
  const [offlineTopic, setOfflineTopic] = useState<string>(OFFLINE_TOPICS[0]);
  const [offlineMessage, setOfflineMessage] = useState("");
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);
  const [offlineSubmitState, setOfflineSubmitState] = useState<SubmitState>("idle");

  const scrollRef = useRef<HTMLDivElement>(null);
  const token = access.token;

  /** Yalnızca presence API başarılı ve admin online ise canlı chat */
  const isOnline = presenceMode === "online";
  const isOfflineMode = !isOnline;

  useEffect(() => {
    const onAuthChanged = () => setAuthTick((n) => n + 1);
    window.addEventListener("auth-changed", onAuthChanged);
    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, []);

  const launcherCopy = useMemo(() => {
    if (isOnline) {
      return { title: "Canlı Destek", tag: "Çevrimiçi", variant: "online" as const };
    }
    return { title: "Destek Bırakın", tag: "Çevrimdışı", variant: "offline" as const };
  }, [isOnline]);

  const headerCopy = useMemo(() => {
    if (isOnline) {
      return {
        title: "Canlı Destek",
        subtitle: "Şu an çevrimiçiyiz, hemen yanıtlıyoruz.",
        badge: "Çevrimiçi",
      };
    }
    return {
      title: "Destek Talebi Bırakın",
      subtitle: "Şu an çevrimdışı olabiliriz. Mesajınızı bırakın, en kısa sürede dönüş yapalım.",
      badge: presenceMode === "loading" ? "Bağlanıyor…" : "Çevrimdışı",
    };
  }, [isOnline, presenceMode]);

  const loadPresence = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const res = await apiClient("/api/admin/presence/status");
      if (res.ok) {
        const data = (await res.json()) as { hasOnlineAdmin?: boolean };
        setPresenceMode(data?.hasOnlineAdmin ? "online" : "offline");
      } else {
        setPresenceMode("offline");
      }
    } catch {
      setPresenceMode("offline");
    }
  }, [token]);

  const loadConversation = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoadError(null);
    try {
      const res = await apiClient("/api/chat/conversation");
      if (!res.ok) {
        throw new Error("Konuşma yüklenemedi");
      }
      const data = (await res.json()) as {
        conversation?: { id?: string };
        messages?: ChatMessage[];
      };
      const cid = data?.conversation?.id || null;
      setConversationId(cid);

      if (data?.messages?.length) {
        setMessages(data.messages);
        return;
      }

      if (cid) {
        const msgRes = await apiClient(`/api/chat/messages?conversationId=${encodeURIComponent(cid)}`);
        if (msgRes.ok) {
          const msgData = (await msgRes.json()) as { messages?: ChatMessage[] };
          setMessages(msgData?.messages || []);
        }
      } else {
        setMessages([]);
      }
    } catch {
      setLoadError("Sohbet geçmişi yüklenemedi. Lütfen tekrar deneyin.");
    }
  }, [token]);

  const loadMessages = useCallback(async () => {
    if (!token || !open || !isOnline) {
      return;
    }
    try {
      const url = conversationId
        ? `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`
        : "/api/chat/conversation";
      const res = await apiClient(url);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as {
        conversation?: { id?: string };
        messages?: ChatMessage[];
      };
      setMessages(data?.messages || []);
      if (!conversationId && data?.conversation?.id) {
        setConversationId(data.conversation.id);
      }
    } catch {
      /* sessiz yenileme */
    }
  }, [token, open, conversationId, isOnline]);

  useEffect(() => {
    if (!access.show) {
      return;
    }
    const stored = readStoredUser();
    setOfflineName(stored.name);
    setOfflineEmail(stored.email);
    void loadPresence();
    const t = setInterval(() => void loadPresence(), POLL_INTERVAL);
    return () => clearInterval(t);
  }, [access.show, loadPresence]);

  useEffect(() => {
    if (!open || !isOnline) {
      return;
    }
    setLoading(true);
    void loadConversation().finally(() => setLoading(false));
  }, [open, isOnline, loadConversation]);

  useEffect(() => {
    if (!open || !isOnline) {
      return;
    }
    const t = setInterval(() => void loadMessages(), POLL_INTERVAL);
    return () => clearInterval(t);
  }, [open, isOnline, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, offlineSubmitState]);

  const sendMessage = async () => {
    const text = input.trim().slice(0, 1000);
    if (!text || sending || !isOnline) {
      return;
    }

    let cid = conversationId;
    if (!cid) {
      try {
        const r = await apiClient("/api/chat/conversation");
        if (!r.ok) {
          return;
        }
        const d = (await r.json()) as { conversation?: { id?: string } };
        cid = d?.conversation?.id || null;
        if (cid) {
          setConversationId(cid);
        }
      } catch {
        return;
      }
    }
    if (!cid) {
      return;
    }

    setSending(true);
    try {
      const res = await apiClient("/api/chat/message", {
        method: "POST",
        body: JSON.stringify({ conversationId: cid, message: text }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message: ChatMessage };
        setMessages((prev) => [...prev, data.message]);
        setInput("");
      }
    } finally {
      setSending(false);
    }
  };

  const submitOfflineTicket = async () => {
    const name = offlineName.trim();
    const email = offlineEmail.trim();
    const topic = offlineTopic.trim() || OFFLINE_TOPICS[0];
    const message = offlineMessage.trim();

    if (!name || !email || !message) {
      setOfflineSubmitState("error");
      return;
    }

    setOfflineSubmitting(true);
    setOfflineSubmitState("idle");
    try {
      const description = [`Gönderen: ${name}`, `E-posta: ${email}`, "", message].join("\n");

      const res = await apiClient("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: `[Çevrimdışı Destek] ${topic}`,
          description,
          priority: "medium",
        }),
      });

      if (!res.ok) {
        throw new Error("ticket failed");
      }

      setOfflineSubmitState("success");
      setOfflineMessage("");
    } catch {
      setOfflineSubmitState("error");
    } finally {
      setOfflineSubmitting(false);
    }
  };

  const selectTopic = (topic: string) => {
    setOfflineTopic(topic);
    if (!offlineMessage.trim() || OFFLINE_TOPICS.some((t) => offlineMessage.startsWith(t))) {
      setOfflineMessage(topic === "Diğer" ? "" : `${topic}\n\n`);
    }
  };

  const imgUrl = (url: string) => (url.startsWith("http") ? url : `${API_BASE_URL}${url}`);

  if (!access.show || !token) {
    return null;
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setOfflineSubmitState("idle");
          }}
          className={`${styles.launcher} ${launcherCopy.variant === "online" ? styles.launcherOnline : styles.launcherOffline}`}
          aria-label={launcherCopy.title}
        >
          <span className={styles.launcherIconWrap} aria-hidden>
            <MessageSquare className={styles.launcherIcon} />
            <span
              className={`${styles.launcherPulse} ${launcherCopy.variant === "online" ? styles.launcherPulseOnline : styles.launcherPulseOffline}`}
            />
          </span>
          <span className={styles.launcherText}>
            <span className={styles.launcherTitle}>{launcherCopy.title}</span>
            <span className={styles.launcherTag}>{launcherCopy.tag}</span>
          </span>
        </button>
      )}

      {open && (
        <div className={styles.overlay}>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden />
          <div
            className={`${styles.panel} ${isOnline ? styles.panelOnline : styles.panelOffline}`}
            role="dialog"
            aria-label={headerCopy.title}
          >
            <header className={`${styles.header} ${isOnline ? styles.headerOnline : styles.headerOffline}`}>
              <div className={styles.headerMain}>
                <div className={styles.brandMark} aria-hidden>
                  BH
                </div>
                <div className={styles.headerCopy}>
                  <h3 className={styles.headerTitle}>{headerCopy.title}</h3>
                  <p className={styles.headerSubtitle}>{headerCopy.subtitle}</p>
                  <span className={styles.statusBadge}>
                    <span
                      className={`${styles.statusDot} ${isOnline ? styles.statusDotOnline : styles.statusDotOffline}`}
                      aria-hidden
                    />
                    {headerCopy.badge}
                  </span>
                </div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Kapat">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div ref={scrollRef} className={styles.body}>
              {offlineSubmitState === "success" && isOfflineMode ? (
                <div className={styles.successScreen}>
                  <CheckCircle2 className={styles.successIcon} aria-hidden />
                  <h4 className={styles.successTitle}>Mesajınız alındı</h4>
                  <p className={styles.successText}>En kısa sürede size dönüş yapacağız.</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setOpen(false);
                      setOfflineSubmitState("idle");
                    }}
                  >
                    Kapat
                  </Button>
                </div>
              ) : isOnline ? (
                <>
                  {loading ? (
                    <p className={styles.loadingText}>Yükleniyor…</p>
                  ) : loadError ? (
                    <p className={styles.alertError}>{loadError}</p>
                  ) : messages.length === 0 ? (
                    <div className={styles.emptyState}>
                      <Headphones className={styles.emptyIcon} aria-hidden />
                      <p className={styles.emptyTitle}>Merhaba!</p>
                      <p className={styles.emptyText}>Size nasıl yardımcı olabiliriz? Mesajınızı yazın, hemen yanıtlayalım.</p>
                    </div>
                  ) : (
                    <div className={styles.messages}>
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={m.senderType === "user" ? styles.messageRowUser : styles.messageRowAdmin}
                        >
                          <div className={m.senderType === "user" ? styles.bubbleUser : styles.bubbleAdmin}>
                            {m.senderType === "admin" && (
                              <p className={styles.bubbleSender}>Bilirkişi Hesap</p>
                            )}
                            {m.imageUrl && (
                              <a href={imgUrl(m.imageUrl)} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={imgUrl(m.imageUrl)}
                                  alt="Gönderilen görsel"
                                  className={styles.bubbleImage}
                                />
                              </a>
                            )}
                            {m.message && m.message !== "[Görsel]" && <p>{m.message}</p>}
                            <p className={styles.bubbleMeta}>
                              {new Date(m.createdAt).toLocaleTimeString("tr-TR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <form
                  className={styles.offlineForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitOfflineTicket();
                  }}
                >
                  {offlineSubmitState === "error" && (
                    <p className={styles.alertError}>
                      Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin.
                    </p>
                  )}

                  <p className={styles.formIntro}>
                    Ekibimiz şu an çevrimdışı. Formu doldurun; talebiniz destek paneline kaydedilir.
                  </p>

                  <div>
                    <p className={styles.fieldLabel}>Konu seçin</p>
                    <div className={styles.topicGrid}>
                      {OFFLINE_TOPICS.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          className={`${styles.topicChip} ${offlineTopic === topic ? styles.topicChipActive : ""}`}
                          onClick={() => selectTopic(topic)}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={styles.fieldLabel} htmlFor="support-offline-name">
                      Ad Soyad
                    </label>
                    <input
                      id="support-offline-name"
                      className={styles.fieldInput}
                      value={offlineName}
                      onChange={(e) => setOfflineName(e.target.value)}
                      maxLength={120}
                      required
                    />
                  </div>

                  <div>
                    <label className={styles.fieldLabel} htmlFor="support-offline-email">
                      E-posta
                    </label>
                    <input
                      id="support-offline-email"
                      type="email"
                      className={styles.fieldInput}
                      value={offlineEmail}
                      onChange={(e) => setOfflineEmail(e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>

                  <div>
                    <label className={styles.fieldLabel} htmlFor="support-offline-message">
                      Mesaj
                    </label>
                    <textarea
                      id="support-offline-message"
                      className={styles.fieldTextarea}
                      value={offlineMessage}
                      onChange={(e) => setOfflineMessage(e.target.value.slice(0, 2000))}
                      placeholder="Mesajınızı yazın…"
                      required
                    />
                  </div>
                </form>
              )}
            </div>

            {!(offlineSubmitState === "success" && isOfflineMode) && (
              <footer className={styles.footer}>
                {isOnline ? (
                  <>
                    <div className={styles.footerRow}>
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                          }
                        }}
                        placeholder="Mesajınızı yazın…"
                        maxLength={1000}
                        className={styles.fieldInput}
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => void sendMessage()}
                        disabled={!input.trim() || sending}
                        className={styles.sendBtn}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className={styles.helpText}>Enter ile gönderebilirsiniz.</p>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      className={styles.submitBtn}
                      disabled={offlineSubmitting}
                      onClick={() => void submitOfflineTicket()}
                    >
                      {offlineSubmitting ? "Gönderiliyor…" : "Mesajı Gönder"}
                    </Button>
                    <p className={styles.helpText}>Talebiniz destek paneline kaydedilir ve e-posta ile iletilir.</p>
                  </>
                )}
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}
