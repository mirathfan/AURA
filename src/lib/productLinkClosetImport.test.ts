import {
  draftFromProductLinkPreview,
  candidateFromProductLinkDraft,
  previewFromSafeHmClientFallback,
} from "./productLinkClosetImport";

jest.mock("@/src/lib/firebase", () => ({ app: {} }));
jest.mock("@/src/lib/aura", () => ({ buildClientProductLinkPreview: jest.fn() }));

describe("mobile product-link compatibility", () => {
  test("H&M blocked-server client preview normalizes into the existing preview shape", () => {
    const sourceUrl = "https://www2.hm.com/en_us/productpage.1288186012.html";
    const preview = previewFromSafeHmClientFallback(sourceUrl, {
      sourceUrl,
      title: "Loose Straight Jeans",
      brand: "H&M",
      color: "Light denim blue",
      priceAmount: 29.99,
      priceCurrency: "USD",
      imageUrl: "https://image.hm.com/assets/product-main.jpg?imwidth=1260",
      imageUrls: [
        "https://image.hm.com/assets/product-main.jpg?imwidth=1260",
        "https://cdn.example.com/rejected.jpg",
      ],
    });

    expect(preview?.metadata.selectedImageReason).toBe("client_hm_preview_fallback");
    expect(preview?.metadata.imageCandidateCount).toBe(1);
    expect(preview?.candidate.primaryImageUrl).toContain("image.hm.com");
    expect(draftFromProductLinkPreview(preview!)).toMatchObject({
      name: "Loose Straight Jeans",
      brand: "H&M",
      color: "Light denim blue",
    });
  });

  test("H&M fallback rejects foreign image hosts and non-H&M URLs", () => {
    const sourceUrl = "https://www2.hm.com/en_us/productpage.1288186012.html";
    const unsafePreview = {
      sourceUrl,
      title: "Loose Straight Jeans",
      imageUrl: "https://cdn.example.com/product.jpg",
      imageUrls: ["https://cdn.example.com/product.jpg"],
    };
    expect(previewFromSafeHmClientFallback(sourceUrl, unsafePreview)).toBeNull();
    expect(previewFromSafeHmClientFallback("https://example.com/product/1", unsafePreview)).toBeNull();
  });

  test("a classified bottom survives conflicting hints and a user category edit survives the save", () => {
    const preview = {
      candidate: {
        candidateId: "cargo", imageUrls: [], title: "Pocket Cargo Pants", category: "top",
        sourceType: "link" as const, status: "needs_review" as const,
      },
      metadata: {
        sourceUrl: "https://kotn.com/products/cargo", domain: "kotn.com", category: "bottom", categoryHints: ["top"],
      },
    };
    const draft = draftFromProductLinkPreview(preview);
    expect(draft.category).toBe("bottom");
    expect(candidateFromProductLinkDraft({ preview, draft }).category).toBe("bottom");
    expect(candidateFromProductLinkDraft({ preview, draft: { ...draft, category: "outerwear" } }).category).toBe("outerwear");
  });

  test("released preview fields still produce the same editable draft", () => {
    const draft = draftFromProductLinkPreview({
      candidate: {
        candidateId: "fixture",
        imageUrls: ["https://cdn.example.com/shoe.jpg"],
        title: "Air Runner Shoes",
        brand: "Example Brand",
        color: "Black",
        category: "sneaker",
        sourceType: "link",
        sourceUrl: "https://example.com/products/runner",
        status: "needs_review",
      },
      metadata: {
        sourceUrl: "https://example.com/products/runner",
        domain: "example.com",
        title: "Air Runner Shoes",
        brand: "Example Brand",
        category: "sneaker",
        color: "Black",
      },
    });
    expect(draft).toEqual({
      name: "Air Runner Shoes",
      brand: "Example Brand",
      category: "shoes",
      color: "Black",
      size: "",
    });
  });
});
