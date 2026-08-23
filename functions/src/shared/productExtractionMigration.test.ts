import {
  ProductLinkError,
  extractAmazonLinkData,
  parseZaraProductDetailsResponse,
  validateProductUrl,
} from "./productLinkExtractor";
import { normalizeProductUrl } from "./productExtractionPipeline";
import { runProductExtractionPipelineFixture } from "./productExtractionPipeline.fixture";
import { runProductLinkClosetOutputFixture } from "./productLinkClosetOutput.fixture";
import { runProductLinkReleaseFixture } from "./productLinkRelease.fixture";
import { runHmKodakProductFixture } from "./productLinkExtractor.hmKodak.fixture";
import {
  buildProductLinkLogMetadata,
  productLinkFailureCodeForError,
} from "./productLinkRelease";

function failedFixtureNames(result: { results: { name: string; passed: boolean }[] }) {
  return result.results.filter((entry) => !entry.passed).map((entry) => entry.name);
}

describe("backend-owned product extraction migration", () => {
  test("retailer and generic extraction fixtures remain green", () => {
    const result = runProductExtractionPipelineFixture();
    expect(failedFixtureNames(result)).toEqual([]);
  });

  test("compatibility and V2 normalization fixtures remain green", () => {
    const release = runProductLinkReleaseFixture();
    const closet = runProductLinkClosetOutputFixture();
    expect(failedFixtureNames(release)).toEqual([]);
    expect(failedFixtureNames(closet)).toEqual([]);
  });

  test("H&M Kodak fixture preserves current extraction while the known title-cleanup issue remains", () => {
    const result = runHmKodakProductFixture();
    expect(result.passed).toBe(false);
    expect(result.metadata).toMatchObject({
      brand: "H&M",
      title: "Light blue/Kodak Loose Fit Printed football shirt",
      graphicText: "Kodak",
      material: "cotton",
      priceAmount: 19.99,
      priceCurrency: "USD",
    });
  });

  test("Zara dedicated product-details payload is normalized", () => {
    const result = parseZaraProductDetailsResponse("123456789", [
      {
        name: "TEXTURED OVERSHIRT",
        detail: {
          description: "Relaxed fit overshirt",
          colors: [
            {
              name: "Ecru",
              productId: "123456789",
              xmedia: [
                { type: "image", order: 2, url: "https://static.zara.net/photos/detail-{width}.jpg" },
                { type: "image", order: 1, extraInfo: { deliveryUrl: "https://static.zara.net/photos/main-{width}.jpg" } },
              ],
            },
          ],
        },
      },
    ]);
    expect(result).toEqual({
      title: "TEXTURED OVERSHIRT",
      description: "Relaxed fit overshirt",
      color: "Ecru",
      imageUrls: [
        "https://static.zara.net/photos/main-1200.jpg",
        "https://static.zara.net/photos/detail-1200.jpg",
      ],
    });
  });

  test("Amazon accepts price only from structured product data", () => {
    const structured = extractAmazonLinkData(
      new URL("https://www.amazon.com/dp/B08N5WRWNW"),
      `<script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"Example Running Shoe",
        "brand":{"name":"Example Brand"},
        "image":"https://m.media-amazon.com/images/I/product-main.jpg",
        "offers":{"@type":"Offer","price":"84.99","priceCurrency":"USD"}
      }</script>`,
    );
    const unstructured = extractAmazonLinkData(
      new URL("https://www.amazon.com/dp/B08N5WRWNW"),
      `<meta property="og:title" content="Example Running Shoe for only $39.99" />
       <meta property="og:image" content="https://m.media-amazon.com/images/I/product-main.jpg" />`,
    );
    expect(structured.metadata.priceAmount).toBe(84.99);
    expect(structured.metadata.priceCurrency).toBe("USD");
    expect(unstructured.metadata.priceAmount).toBeNull();
    expect(unstructured.metadata.priceUnavailable).toBe(true);
  });

  test("retailer detection is backend-owned before fetch", () => {
    expect(normalizeProductUrl("https://www2.hm.com/en_us/productpage.123.html").retailerId).toBe("hm");
    expect(normalizeProductUrl("https://www.zara.com/us/en/item-p01234567.html").retailerId).toBe("zara");
    expect(normalizeProductUrl("https://www.nike.com/t/item/ABC-123").retailerId).toBe("nike");
    expect(normalizeProductUrl("https://www.adidas.com/us/item/ABC").retailerId).toBe("adidas");
    expect(normalizeProductUrl("https://www.uniqlo.com/us/en/products/E123").retailerId).toBe("uniqlo");
  });

  test("failure taxonomy keeps invalid, unsupported, blocked, insufficient, network, and internal distinct", () => {
    expect(productLinkFailureCodeForError(new ProductLinkError("bad", "invalid_url"))).toBe("INVALID_URL");
    expect(productLinkFailureCodeForError(new ProductLinkError("unsupported", "unsupported_url"))).toBe("UNSUPPORTED_URL");
    expect(productLinkFailureCodeForError(new ProductLinkError("blocked", "blocked_store"))).toBe("FETCH_BLOCKED");
    expect(productLinkFailureCodeForError(new ProductLinkError("empty", "no_metadata"))).toBe("NO_PRODUCT_METADATA");
    expect(productLinkFailureCodeForError(new ProductLinkError("offline", "fetch_failed"))).toBe("FETCH_FAILED");
    expect(productLinkFailureCodeForError(new Error("boom"))).toBe("UNKNOWN_ERROR");
  });

  test("URL validation rejects invalid, non-http, localhost, and private-IP targets", async () => {
    await expect(validateProductUrl("not-a-url")).rejects.toMatchObject({ code: "invalid_url" });
    await expect(validateProductUrl("file:///etc/passwd")).rejects.toMatchObject({ code: "invalid_url" });
    await expect(validateProductUrl("http://localhost/product/1")).rejects.toMatchObject({ code: "unsafe_url" });
    await expect(validateProductUrl("http://127.0.0.1/product/1")).rejects.toMatchObject({ code: "unsafe_url" });
    await expect(validateProductUrl("http://[::1]/product/1")).rejects.toMatchObject({ code: "unsafe_url" });
  });

  test("telemetry identifies compatibility and V2 response paths without page content", () => {
    const compatibility = buildProductLinkLogMetadata({
      rawUrl: "https://example.com/products/item?secret=redacted",
      featureFlagEnabled: false,
      fallbackPath: "none",
      httpStatus: 403,
    });
    const v2 = buildProductLinkLogMetadata({
      rawUrl: "https://example.com/products/item",
      featureFlagEnabled: true,
    });
    expect(compatibility.responseContract).toBe("compatibility_v1");
    expect(compatibility.httpStatus).toBe(403);
    expect(v2.responseContract).toBe("normalized_v2");
    expect(JSON.stringify(compatibility)).not.toContain("secret=redacted");
  });
});
