import { useCallback, useEffect, useRef } from "react";

/** Sunucu typing TTL (10s) ile uyumlu; poll 2–3s */
const TYPING_IDLE_MS = 5000;
const TYPING_PULSE_MS = 2000;

type Options = {
  enabled: boolean;
  sendTyping: (typing: boolean) => Promise<void>;
};

export function useChatTypingEmitter({ enabled, sendTyping }: Options) {
  const isTypingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPulseRef = useRef(0);
  const sendTypingRef = useRef(sendTyping);

  sendTypingRef.current = sendTyping;

  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    if (enabled) {
      void sendTypingRef.current(false).catch(() => {});
    }
  }, [enabled]);

  const notifyTyping = useCallback(() => {
    if (!enabled) return;

    const now = Date.now();
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      void sendTypingRef.current(true).catch(() => {});
      lastPulseRef.current = now;
    } else if (now - lastPulseRef.current >= TYPING_PULSE_MS) {
      void sendTypingRef.current(true).catch(() => {});
      lastPulseRef.current = now;
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_IDLE_MS);
  }, [enabled, stopTyping]);

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  useEffect(() => {
    if (!enabled) {
      stopTyping();
    }
  }, [enabled, stopTyping]);

  return { notifyTyping, stopTyping };
}
