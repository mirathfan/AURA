import type { AIMessage } from "@/src/components/ai/chatTypes";
import { resolveOutfitSave } from "@/src/lib/auraOutfitSave";
import type { AuraAgentOutfit } from "@/src/types/auraAgent";

function card(outfitId: string, title: string, pants: string): AuraAgentOutfit {
  return {
    outfitId, title, vibe: "polished", occasion: "date", formality: "smart_casual",
    explanation: "", confidence: 1, stylingTips: [], missingItems: [],
    items: [{ itemId: pants, name: pants, role: "bottom", category: "pants", colors: [], imageUrl: null, reason: "" }],
  };
}
const first = card("outfit-1", "First dinner look", "pants-A");
const second = card("outfit-2", "Charcoal dinner", "pants-B");
const edited = card("outfit-1", "Warm charcoal", "pants-B");
function batch(id: string, outfits: AuraAgentOutfit[]): AIMessage {
  return { id, createdAt: 1, type: "assistant", agentResponse: {
    mode: "generate_outfit", message: "", suggestedActions: [], outfits,
    intent: { mode: "generate_outfit", query: "", normalizedQuery: "", confidence: 1, reason: "",
      constraints: { formality: "smart_casual", preferredColors: [], requiredColors: [], requiredCategories: [],
        styleHints: [], avoidItemIds: [], avoidCategories: [], avoidTerms: [], selectedItemIds: [] } },
  } };
}
const options = batch("three-looks", [first, second]);
const editPrompt: AIMessage = { id: "edit", type: "user", createdAt: 2,
  text: "I like the second one. Keep the pants, swap the shoes, and make it work for a cold walk." };
const failed: AIMessage = { id: "error", type: "system/action", createdAt: 3, text: "Try again." };
const ask: AIMessage = { id: "choose", type: "assistant", createdAt: 4, outfitSave: { kind: "choose" } };

it.each(["Save that one.", "Save this outfit", "Could you save that look for me?"])(
  "%s resolves to the actual edited card even when another batch reuses the card ID", (prompt) => {
    const source = batch("revision", [edited]);
    expect(resolveOutfitSave(prompt, [options, editPrompt, source], { messageId: options.id, outfitId: first.outfitId }))
      .toEqual({ kind: "save", source, outfit: edited });
  },
);
it("asks which look and accepts the next ordinal without another save command", () => {
  expect(resolveOutfitSave("Save that one", [options])).toMatchObject({ kind: "choose", text: expect.stringContaining(second.title) });
  expect(resolveOutfitSave("The second one.", [options, ask])).toEqual({ kind: "save", source: options, outfit: second });
  expect(resolveOutfitSave("The second one.", [options])).toBeNull();
  expect(resolveOutfitSave("Save option 9", [options])).toMatchObject({ kind: "choose" });
});
it("recognizes a carousel choice scoped to its own batch", () => {
  expect(resolveOutfitSave("Save that one", [options], { messageId: options.id, outfitId: second.outfitId }))
    .toEqual({ kind: "save", source: options, outfit: second });
});
it("identifies the unedited look after a failed edit and waits for an explicit choice", () => {
  const history = [options, editPrompt, failed];
  expect(resolveOutfitSave("Save that one", history)).toMatchObject({ kind: "choose", text: expect.stringContaining('Option 2, “Charcoal dinner”') });
  expect(resolveOutfitSave("Option 2", [...history, ask])).toEqual({ kind: "save", source: options, outfit: second });
});
it("handles no card, negation, unrelated asks and retries of older targets", () => {
  expect(resolveOutfitSave("Save that one", [])).toMatchObject({ kind: "unavailable" });
  for (const text of ["Don't save that one", "What happens if I save this outfit?", "Save as preference", "Save this outfit for Friday"]) {
    expect(resolveOutfitSave(text, [options])).toBeNull();
  }
  const later = batch("new", [edited]);
  expect(resolveOutfitSave("Save that one", [options, later], null, { kind: "target", messageId: options.id, outfitId: second.outfitId }))
    .toEqual({ kind: "save", source: options, outfit: second });
});
