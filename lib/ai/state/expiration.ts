import type { ConversationState } from "@/lib/ai/state/types";

/** After this much inactivity, a persisted state is treated as stale and discarded on load rather than resumed -- see lib/ai/state/store.ts's loadConversationState. */
export const STATE_TTL_MS = 30 * 60 * 1000;

export function isExpired(state: ConversationState, now: Date, ttlMs: number = STATE_TTL_MS): boolean {
  const lastActivity = new Date(state.lastActivityAt).getTime();
  // A corrupt/unparseable timestamp is the safest thing to treat as expired -- resuming from unknown-age state is worse than starting fresh.
  if (Number.isNaN(lastActivity)) return true;
  return now.getTime() - lastActivity > ttlMs;
}
