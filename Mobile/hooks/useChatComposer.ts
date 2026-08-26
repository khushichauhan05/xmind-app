/**
 * Chat composer hook.
 *
 * Owns the draft text and generates an idempotency key per send.
 * Uses `expo-crypto.randomUUID()` when available (it's universal in
 * SDK 54), with a defensive fallback for any environment where it
 * isn't (e.g. older OTA bundles, web preview).
 */
import { useCallback, useMemo, useState } from "react";
import * as Crypto from "expo-crypto";

import { useMessages } from "./useMessages";

function safeUuid(): string {
  try {
    if (typeof Crypto.randomUUID === "function") return Crypto.randomUUID();
  } catch {
    // fall through
  }
  // Time-based fallback. Not RFC4122-conformant; that's fine — it just
  // needs to be locally unique per sender.
  const rand = Math.random().toString(36).slice(2, 10);
  return `c-${Date.now().toString(36)}-${rand}`;
}

export interface UseChatComposerResult {
  draft: string;
  setDraft: (next: string) => void;
  /** True while a send is in-flight (the optimistic row is already on screen). */
  isSending: boolean;
  /** True when the current draft is non-empty after trim. */
  canSend: boolean;
  send: () => Promise<void>;
  /** Clear the draft (e.g. when the modal closes). */
  reset: () => void;
}

const MAX_LEN = 2000;

export const useChatComposer = (
  conversationId: string | null | undefined
): UseChatComposerResult => {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { send: sendMessage } = useMessages(conversationId);

  const canSend = useMemo(
    () => draft.trim().length > 0 && draft.trim().length <= MAX_LEN,
    [draft]
  );

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || !conversationId) return;

    const clientId = safeUuid();
    setDraft("");
    setIsSending(true);
    try {
      await sendMessage({ body, clientId });
    } catch {
      // Error state is reflected on the optimistic row via
      // `useMessages` — nothing more for the composer to do.
    } finally {
      setIsSending(false);
    }
  }, [conversationId, draft, sendMessage]);

  const reset = useCallback(() => setDraft(""), []);

  return { draft, setDraft, isSending, canSend, send, reset };
};
