export type AuraCandidateSaveMode = "pending" | "awaiting_confirmation" | "reviewed_product_link";

export function initialAuraCandidateLifecycle(mode: AuraCandidateSaveMode, sourceType: string | undefined) {
  if (mode === "reviewed_product_link") {
    if (sourceType !== "link") throw new Error("A reviewed product link must have a link candidate.");
    return { isDraft: false, draftState: "ready", itemLifecycleStatus: "ready", ingestionStatus: "done" } as const;
  }

  return {
    isDraft: true,
    draftState: mode === "awaiting_confirmation" ? "draft" : "photo_uploaded",
    itemLifecycleStatus: mode === "awaiting_confirmation" ? "candidate" : "processing",
    ingestionStatus: "pending",
  } as const;
}
