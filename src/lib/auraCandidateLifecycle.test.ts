import { initialAuraCandidateLifecycle } from "./auraCandidateLifecycle";

describe("initial lifecycle after reviewing an AURA candidate", () => {
  it("saves the reviewed retailer metadata directly to the wardrobe", () => {
    expect(initialAuraCandidateLifecycle("reviewed_product_link", "link")).toEqual({
      isDraft: false, draftState: "ready", itemLifecycleStatus: "ready", ingestionStatus: "done",
    });
  });

  it("keeps pending photos and unconfirmed links in the draft workflow", () => {
    expect(initialAuraCandidateLifecycle("pending", "image")).toEqual({
      isDraft: true, draftState: "photo_uploaded", itemLifecycleStatus: "processing", ingestionStatus: "pending",
    });
    expect(initialAuraCandidateLifecycle("awaiting_confirmation", "link")).toMatchObject({
      isDraft: true, itemLifecycleStatus: "candidate",
    });
    expect(() => initialAuraCandidateLifecycle("reviewed_product_link", "image")).toThrow();
  });
});
