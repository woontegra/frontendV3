import { apiClient } from "@/utils/apiClient";

export async function postUserTyping(conversationId: string, typing: boolean): Promise<boolean> {
  const res = await apiClient("/api/chat/typing", {
    method: "POST",
    body: JSON.stringify({ conversationId, typing }),
  });
  return res.ok;
}

export async function fetchUserAdminTyping(conversationId: string): Promise<boolean | null> {
  const res = await apiClient(
    `/api/chat/typing-status?conversationId=${encodeURIComponent(conversationId)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { adminTyping?: boolean };
  return !!data?.adminTyping;
}

export async function resolveConversationId(): Promise<string | null> {
  const res = await apiClient("/api/chat/conversation");
  if (!res.ok) return null;
  const data = (await res.json()) as { conversation?: { id?: string } };
  return data?.conversation?.id || null;
}
