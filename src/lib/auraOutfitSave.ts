import type { AIMessage } from "@/src/components/ai/chatTypes";
import { referencedOutfitIndex } from "@/src/lib/auraAgentActions";
import type { AuraAgentOutfit } from "@/src/types/auraAgent";
import { classifyAuraStylingIntent } from "@/shared/auraStylingIntelligence";

type CardReference = { messageId: string; outfitId: string };
type SaveDecision =
  | { kind: "save"; source: AIMessage; outfit: AuraAgentOutfit }
  | { kind: "choose" | "unavailable"; text: string };

const SAVE_COMMAND = /^(?:(?:can|could|would) you )?(?:please )?(?:save|bookmark) (.+?)(?: for me| to my saved outfits)?(?: please)?$/i;
const DEMONSTRATIVE = /^(?:it|(?:this|that|the|the selected|the edited|the updated)(?: (?:one|outfit|look|fit))?)$/i;
const ORDINAL_CHOICE = /^(?:the )?(?:(?:first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?) (?:one|outfit|look|option|fit)|(?:outfit|look|option|fit) (?:\d+|one|two|three|four|five))$/i;

export function resolveOutfitSave(
  prompt: string,
  history: AIMessage[],
  selection?: CardReference | null,
  retryReference?: AIMessage["outfitSave"],
): SaveDecision | null {
  // Retrying a user message must keep the original card even if the carousel has since moved.
  if (retryReference?.kind === "target") {
    const source = history.find((message) => message.id === retryReference.messageId);
    const outfit = source?.agentResponse?.outfits?.find((card) => card.outfitId === retryReference.outfitId);
    if (source && outfit) return { kind: "save", source, outfit };
    return { kind: "unavailable", text: "I couldn't find the original outfit card to save. Generate a new look and try again." };
  }
  const clean = prompt.trim().replace(/[.!?]+$/, "").trim();
  const command = clean.match(SAVE_COMMAND);
  const awaitingChoice = history[history.length - 1]?.outfitSave?.kind === "choose";
  const rawReference = command?.[1] ?? (awaitingChoice ? clean : "");
  let reference = rawReference.replace(/^the /i, "");
  if (/^(?:[1-9]|one|two|three|four|five)$/i.test(reference)) reference = `option ${reference}`;
  if (/^(?:first|second|third|fourth|fifth)$/i.test(reference)) reference += " one";
  const ordinal = ORDINAL_CHOICE.test(reference) ? referencedOutfitIndex(reference) : null;
  if (ordinal == null && !(command && DEMONSTRATIVE.test(rawReference))) return null;

  const sourceIndex = history.map((message) => !!message.agentResponse?.outfits?.length).lastIndexOf(true);
  const source = history[sourceIndex];
  const outfits = source?.agentResponse?.outfits;
  if (!outfits?.length) return { kind: "unavailable", text: "There isn't an outfit card in this chat to save yet." };
  if (ordinal != null && outfits[ordinal]) return { kind: "save", source, outfit: outfits[ordinal] };

  const choices = outfits.map((outfit, index) => `${index + 1}. ${outfit.title}`).join("\n");
  if (ordinal == null) {
    const intervening = history.slice(sourceIndex + 1);
    const edit = [...intervening].reverse().find((message) => message.type === "user" && message.text &&
      classifyAuraStylingIntent(message.text, { hasPreviousOutfit: true }).requestedChanges.length > 0);
    if (edit) {
      const originalIndex = referencedOutfitIndex(edit.text ?? "") ?? (outfits.length === 1 ? 0 : null);
      const original = originalIndex != null ? outfits[originalIndex] : null;
      const available = original && originalIndex != null
        ? `Option ${originalIndex + 1}, “${original.title}”, is still available unchanged. Reply “Save option ${originalIndex + 1}” to save it.`
        : "Which original look should I save?\n" + choices;
      return { kind: "choose", text: "The edit didn't produce a new outfit card. " + available };
    }
    const selected = selection?.messageId === source.id
      ? outfits.find((outfit) => outfit.outfitId === selection.outfitId) : undefined;
    if (selected || outfits.length === 1) return { kind: "save", source, outfit: selected ?? outfits[0] };
  }
  return { kind: "choose", text: "Which look should I save? Reply with its option number.\n" + choices };
}
