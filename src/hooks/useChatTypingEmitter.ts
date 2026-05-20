import { useCallback, useEffect, useRef } from "react";

/** Sunucu typing TTL (10s) ile uyumlu; poll 3s */
const TYPING_IDLE_MS = 5000;
const TYPING_PULSE_MS = 2000;

type Options = {
  enabled: boolean;
  conversationId: string | null;
  sendTyping: (typing: boolean) => Promise<void>;
};

export function useChatTypingEmitter({ enabled, conversationId, sendTyping }: Options) {
  const isTypingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPulseRef = useRef(0);

  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    if (enabled && conversationId) {
      void sendTyping(false).catch(() => {});
    }
  }, [enabled, conversationId, sendTyping]);

  const notifyTyping = useCallback(() => {
    if (!enabled || !conversationId) return;

    const now = Date.now();
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      void sendTyping(true).catch(() => {});
      lastPulseRef.current = now;
    } else if (now - lastPulseRef.current >= TYPING_PULSE_MS) {
      void sendTyping(true).catch(() => {});
      lastPulseRef.current = now;
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_IDLE_MS);
  }, [enabled, conversationId, sendTyping, stopTyping]);

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  useEffect(() => {
    if (!enabled || !conversationId) {
      stopTyping();
    }
  }, [enabled, conversationId, stopTyping]);

  return { notifyTyping, stopTyping };
}
