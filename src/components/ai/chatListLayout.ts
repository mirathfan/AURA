import type { AIMessage } from "./chatTypes";

export const AURA_CHAT_CARD_BOTTOM_PADDING = 380;

export function getAuraChatBottomPadding(contentBottomPadding: number) {
  const measured = Number.isFinite(contentBottomPadding) ? contentBottomPadding : 0;
  return Math.max(18, measured, AURA_CHAT_CARD_BOTTOM_PADDING);
}

export function shouldShowAuraTypingBubble({
  loading,
  hasStreamingMessage,
  lastMessage,
}: {
  loading: boolean;
  hasStreamingMessage: boolean;
  lastMessage?: Pick<AIMessage, "type" | "kind"> | null;
}) {
  return loading && !hasStreamingMessage && !!lastMessage && lastMessage.type === "user";
}

// When a reply arrives, bring its top into view so the outfit is what the
// user sees, unless they have scrolled away to read earlier messages. A user
// who only nudged the list, and can still see their own question, is not
// reading back.
export function decideAuraReplyReveal({
  userScrolledThisTurn,
  questionVisible,
  nearBottom,
}: {
  userScrolledThisTurn: boolean;
  questionVisible: boolean;
  nearBottom: boolean;
}): "reveal" | "hold" {
  if (!userScrolledThisTurn) return "reveal";
  return questionVisible || nearBottom ? "reveal" : "hold";
}

// Only outfit replies are revealed from their top: they are tall, and the
// picture is the answer. Streamed text replies keep following the bottom so
// the user can read along.
export function isAuraOutfitReply(message?: Pick<AIMessage, "type" | "kind" | "agentResponse"> | null): boolean {
  if (!message || message.type === "user") return false;
  return message.kind === "aura_agent" || (message.agentResponse?.outfits?.length ?? 0) > 0;
}
