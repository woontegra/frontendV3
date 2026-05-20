import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  ChevronLeft,
  RefreshCw,
  Send,
  UserCheck,
  XCircle,
  Circle,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/api/apiClient";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { useChatTypingEmitter } from "@/hooks/useChatTypingEmitter";
import { emitAdminChatReplySent } from "@/shared/utils/adminChatNotificationBridge";

const POLL_INTERVAL = 5000;
const CHAT_POLL_INTERVAL = 3000;
const PRESENCE_HEARTBEAT = 60 * 1000;

interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  id: string;
  userId: number;
  tenantId: number;
  assignedTo: number | null;
  status: string;
  lastMessageAt: string | null;
  user: { id: number; name: string; email: string };
  assignedAdmin: { id: number; name: string; email: string } | null;
  unreadCount: number;
  isUserTyping?: boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "İstek başarısız oldu. Lütfen tekrar deneyin.";
}

function hasAccessToken(): boolean {
  return !!localStorage.getItem("access_token");
}

export default function AdminChatPage() {
  const [isOnline, setIsOnline] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [listLoading, setListLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [userTyping, setUserTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedId = selected?.id ?? null;

  const loadMyPresence = useCallback(async () => {
    try {
      const data = await apiClient<{ isOnline?: boolean }>("/api/admin/presence/me");
      setIsOnline(!!data?.isOnline);
    } catch {
      setIsOnline(false);
    }
  }, []);

  const togglePresence = useCallback(async () => {
    try {
      const data = await apiClient<{ isOnline?: boolean }>("/api/admin/presence/toggle", {
        method: "POST",
        body: JSON.stringify({ isOnline: !isOnline }),
      });
      setIsOnline(!!data?.isOnline);
    } catch {
      /* ignore */
    }
  }, [isOnline]);

  const loadConversations = useCallback(async () => {
    if (!hasAccessToken()) {
      setListError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }

    try {
      setListError(null);
      const q = filter !== "all" ? `?filter=${filter}` : "";
      const data = await apiClient<{ conversations?: Conversation[] }>(
        `/api/admin/chat/conversations${q}`,
      );
      const list = data?.conversations ?? [];
      setConversations(list);
      setSelected((prev) => {
        if (!prev) return null;
        return list.find((c) => c.id === prev.id) ?? prev;
      });
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  }, [filter]);

  const loadMessages = useCallback(async (conversationId?: string) => {
    const id = conversationId ?? selectedId;
    if (!id || !hasAccessToken()) return;

    try {
      setMessagesError(null);
      const data = await apiClient<{ messages?: ChatMessage[]; userTyping?: boolean }>(
        `/api/admin/chat/messages/${id}`,
      );
      setMessages(data?.messages ?? []);
      setUserTyping(!!data?.userTyping);
    } catch (error) {
      setMessagesError(getErrorMessage(error));
    }
  }, [selectedId]);

  const loadTypingStatus = useCallback(async (conversationId?: string) => {
    const id = conversationId ?? selectedId;
    if (!id || !hasAccessToken()) return;

    try {
      const data = await apiClient<{ userTyping?: boolean }>(
        `/api/admin/chat/typing-status/${id}`,
      );
      setUserTyping(!!data?.userTyping);
    } catch {
      /* sessiz */
    }
  }, [selectedId]);

  const handleRefresh = useCallback(async () => {
    if (!hasAccessToken()) {
      setListError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }

    setRefreshing(true);
    try {
      setListError(null);
      setMessagesError(null);
      const q = filter !== "all" ? `?filter=${filter}` : "";
      const data = await apiClient<{ conversations?: Conversation[] }>(
        `/api/admin/chat/conversations${q}`,
      );
      const list = data?.conversations ?? [];
      setConversations(list);

      const activeId = selectedId;
      if (activeId) {
        const updated = list.find((c) => c.id === activeId);
        if (updated) {
          setSelected(updated);
        }
        const msgData = await apiClient<{ messages?: ChatMessage[]; userTyping?: boolean }>(
          `/api/admin/chat/messages/${activeId}`,
        );
        setMessages(msgData?.messages ?? []);
        setUserTyping(!!msgData?.userTyping);
      } else {
        setSelected((prev) => {
          if (!prev) return null;
          return list.find((c) => c.id === prev.id) ?? prev;
        });
      }
    } catch (error) {
      setListError(getErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }, [filter, selectedId]);

  useEffect(() => {
    void loadMyPresence();
  }, [loadMyPresence]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setListLoading(true);
      await loadConversations();
      if (!cancelled) setListLoading(false);
    };
    void run();
    const t = setInterval(() => void loadConversations(), POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [loadConversations]);

  const sendAdminTyping = useCallback(
    async (typing: boolean) => {
      if (!selectedId) return;
      await apiClient("/api/admin/chat/typing", {
        method: "POST",
        body: JSON.stringify({ conversationId: selectedId, typing }),
      });
    },
    [selectedId],
  );

  const { notifyTyping, stopTyping } = useChatTypingEmitter({
    enabled: isOnline && !!selectedId,
    conversationId: selectedId,
    sendTyping: sendAdminTyping,
  });

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setMessagesError(null);
      setUserTyping(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setMessagesLoading(true);
      await Promise.all([loadMessages(selectedId), loadTypingStatus(selectedId)]);
      if (!cancelled) setMessagesLoading(false);
    };
    void run();

    const msgTimer = setInterval(() => void loadMessages(selectedId), CHAT_POLL_INTERVAL);
    const typingTimer = setInterval(() => void loadTypingStatus(selectedId), CHAT_POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(msgTimer);
      clearInterval(typingTimer);
    };
  }, [selectedId, loadMessages, loadTypingStatus]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, userTyping]);

  useEffect(() => {
    if (!isOnline || !hasAccessToken()) return;
    const heartbeat = () => {
      apiClient("/api/admin/presence/toggle", {
        method: "POST",
        body: JSON.stringify({ isOnline: true }),
      }).catch(() => {});
    };
    const t = setInterval(heartbeat, PRESENCE_HEARTBEAT);
    return () => clearInterval(t);
  }, [isOnline]);

  const handleAssign = async () => {
    if (!selectedId) return;
    try {
      await apiClient(`/api/admin/chat/assign/${selectedId}`, { method: "POST" });
      await loadConversations();
      setSelected((s) => (s ? { ...s, assignedTo: 1 } : null));
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  };

  const handleClose = async () => {
    if (!selectedId) return;
    try {
      await apiClient(`/api/admin/chat/close/${selectedId}`, { method: "POST" });
      setSelected(null);
      setMessages([]);
      await loadConversations();
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  };

  const handleSend = async () => {
    const text = input.trim().slice(0, 1000);
    if (!text || !selectedId || sending) return;
    stopTyping();
    setSending(true);
    try {
      const data = await apiClient<{ message?: ChatMessage }>("/api/admin/chat/message", {
        method: "POST",
        body: JSON.stringify({ conversationId: selectedId, message: text }),
      });
      if (data?.message) {
        const sent = data.message as ChatMessage;
        setMessages((prev) => [...prev, sent]);
        setInput("");
        setUserTyping(false);
        emitAdminChatReplySent({
          conversationId: selectedId,
          lastMessageAt: sent.createdAt ?? new Date().toISOString(),
        });
        await Promise.all([loadConversations(), loadMessages(selectedId)]);
      }
    } catch (error) {
      setMessagesError(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/80 dark:bg-gray-950/50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                <MessageCircle className="h-8 w-8 text-indigo-600" />
                Canlı Sohbet
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Konuşmaları yönetin, kullanıcılara yanıt verin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void togglePresence()}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
                isOnline
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                  : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {isOnline ? (
                <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500 animate-pulse" />
              ) : (
                <CircleDot className="h-2.5 w-2.5 text-gray-500" />
              )}
              {isOnline ? "Çevrimiçi" : "Çevrimdışı"}
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>
        </div>

        {listError ? (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {listError}
          </p>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[400px]">
          <div className="lg:col-span-1 bg-white dark:bg-gray-900/80 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  filter === "all"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setFilter("unassigned")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  filter === "unassigned"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Atanmamış
              </button>
              <button
                onClick={() => setFilter("assigned")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  filter === "assigned"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Bana atanan
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {listLoading && conversations.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Konuşmalar yükleniyor...
                </p>
              ) : conversations.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Açık konuşma yok
                </p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c)}
                    className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      selectedId === c.id
                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {c.user?.name || "Kullanıcı"}
                      </span>
                      {c.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {c.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {c.user?.email}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {c.isUserTyping ? (
                        <span className="text-indigo-600 dark:text-indigo-400">yazıyor…</span>
                      ) : c.lastMessageAt ? (
                        new Date(c.lastMessageAt).toLocaleString("tr-TR")
                      ) : (
                        "Henüz mesaj yok"
                      )}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-gray-900/80 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                Bir konuşma seçin
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {selected.user?.name || "Kullanıcı"}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selected.user?.email}</p>
                  </div>
                  <div className="flex gap-2">
                    {!selected.assignedTo && (
                      <Button size="sm" onClick={() => void handleAssign()} variant="outline">
                        <UserCheck className="h-4 w-4 mr-2" />
                        Sahiplen
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => void handleClose()}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Kapat
                    </Button>
                  </div>
                </div>

                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                >
                  {messagesError ? (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                      {messagesError}
                    </p>
                  ) : null}
                  {messagesLoading && messages.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Mesajlar yükleniyor...
                    </p>
                  ) : null}
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.senderType === "admin" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                          m.senderType === "admin"
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        <p>{m.message}</p>
                        <p className="text-[10px] opacity-80 mt-0.5">
                          {new Date(m.createdAt).toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                  {userTyping ? (
                    <TypingIndicator
                      label="Kullanıcı yazıyor"
                      className="text-xs text-gray-500 dark:text-gray-400 mb-2"
                    />
                  ) : null}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value.slice(0, 1000));
                        notifyTyping();
                      }}
                      onKeyDown={(e) => e.key === "Enter" && void handleSend()}
                      placeholder="Yanıt yazın..."
                      maxLength={1000}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Button
                      size="icon"
                      onClick={() => void handleSend()}
                      disabled={!input.trim() || sending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
