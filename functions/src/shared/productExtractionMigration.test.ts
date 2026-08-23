import {
  ProductLinkError,
  extractAmazonLinkData,
  extractProductMetadataFromHtml,
  looksLikeBlockedProductPage,
  parseZaraProductDetailsResponse,
  productPageHttpError,
  validateProductUrl,
  zaraProductIdFromUrl,
} from "./productLinkExtractor";
import {
  normalizeProductUrl,
  selectBestProductPrice,
  selectBestProductTitle,
  extractStructuredData,
} from "./productExtractionPipeline";
import { filterReachableProductImageUrls } from "./auraCandidatePreview";
import {
  canUseHmBlockedStorePreviewFallback,
  firstUsableProductImageCandidate,
  hmSanitizedClientPreview,
} from "./auraUrlCandidatePreview";
import { runProductExtractionPipelineFixture } from "./productExtractionPipeline.fixture";
import { runProductLinkClosetOutputFixture } from "./productLinkClosetOutput.fixture";
import { runProductLinkReleaseFixture } from "./productLinkRelease.fixture";
import { runHmKodakProductFixture } from "./productLinkExtractor.hmKodak.fixture";
import {
  buildProductLinkLogMetadata,
  isProductLinkExtractionV2Enabled,
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

  test("Zara preserves the leading-zero SEO id used by the live product-details endpoint", () => {
    expect(zaraProductIdFromUrl(new URL(
      "https://www.zara.com/us/en/100-wool-jumper-p06674421.html",
    ))).toBe("06674421");
    expect(zaraProductIdFromUrl(new URL(
      "https://www.zara.com/us/en/item-p06674421.html?v1=452322621",
    ))).toBe("452322621");
  });

  test("Zara accepts the production media URL variants and keeps a usable image", () => {
    const result = parseZaraProductDetailsResponse("06674421", [{
      name: "100% WOOL JUMPER",
      detail: {
        description: "Relaxed fit jumper made of spun wool.",
        colors: [{
          name: "Mink marl",
          productId: "06674421",
          xmedia: [
            {
              type: "image",
              order: 0,
              delivery_url: "//static.zara.net/assets/public/9401/06674421722-p.jpg?w={width}",
            },
          ],
        }],
      },
    }]);
    expect(result.title).toBe("100% WOOL JUMPER");
    expect(result.imageUrls).toEqual([
      "https://static.zara.net/assets/public/9401/06674421722-p.jpg?w=1200",
    ]);
  });

  test("Zara's HTTP 200 Akamai interstitial is classified as a blocked page", () => {
    expect(looksLikeBlockedProductPage(
      `<meta http-equiv="refresh" content="5; URL='?bm-verify=redacted'" />
       <script>function triggerInterstitialChallenge() { fetch('/_sec/verify'); }</script>`,
    )).toBe(true);
    expect(looksLikeBlockedProductPage(
      "<html><head><title>100% Wool Jumper</title></head><body>Product details</body></html>",
    )).toBe(false);
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

  test("current Amazon server response failures retain HTTP classification", () => {
    expect(productPageHttpError(503, "www.amazon.com")).toMatchObject({
      code: "fetch_failed",
      details: { status: 503, reason: "http_503", recoverable: true },
    });
  });

  test("JD Sports and StockX 403 responses remain blocked_store", () => {
    expect(productPageHttpError(403, "www.jdsports.co.uk")).toMatchObject({
      code: "blocked_store",
      details: { status: 403, blockedStore: true },
    });
    expect(productPageHttpError(403, "stockx.com")).toMatchObject({
      code: "blocked_store",
      details: { status: 403, blockedStore: true },
    });
  });

  test("image validation skips a failed primary candidate and keeps the next image", async () => {
    const first = "https://cdn.example.com/products/bad-primary.jpg";
    const second = "https://cdn.example.com/products/good-secondary.jpg";
    const result = await filterReachableProductImageUrls([first, first, second], {
      probe: async (url) => url === second
        ? { reachable: true }
        : { reachable: false, failureReason: "http_404" },
    });
    expect(result.urls).toEqual([second]);
    expect(result.summary).toMatchObject({
      candidateCount: 2,
      attemptedCount: 2,
      reachableCount: 1,
      fetchFailedCount: 1,
      failureReasons: ["http_404"],
    });
  });

  test("image validation returns no candidate when every bounded candidate fails", async () => {
    const result = await filterReachableProductImageUrls([
      "https://cdn.example.com/products/first.jpg",
      "https://cdn.example.com/products/second.jpg",
    ], {
      probe: async () => ({ reachable: false, failureReason: "http_404" }),
    });
    expect(result.urls).toEqual([]);
    expect(result.summary.fetchFailedCount).toBe(2);
  });

  test("downstream image download skips a stale primary and uses the next candidate", async () => {
    const first = "https://cdn.example.com/products/stale-primary.jpg";
    const second = "https://cdn.example.com/products/live-secondary.jpg";
    const result = await firstUsableProductImageCandidate({
      imageUrls: [first, second],
      attempt: async (url) => {
        if (url === first) throw new Error("400 Error while downloading file. Upstream status code: 404.");
        return { url };
      },
    });
    expect(result.value).toEqual({ url: second });
    expect(result.imageUrl).toBe(second);
    expect(Array.from(result.failed.values())).toEqual(["http_404"]);
  });

  test("downstream image download returns no candidate when all bounded candidates fail", async () => {
    const result = await firstUsableProductImageCandidate({
      imageUrls: [
        "https://cdn.example.com/products/stale-primary.jpg",
        "https://cdn.example.com/products/stale-secondary.jpg",
      ],
      attempt: async () => {
        throw new Error("400 Error while downloading file. Upstream status code: 404.");
      },
    });
    expect(result.value).toBeNull();
    expect(result.failed.size).toBe(2);
  });

  test("product titles outrank color and size variant labels", () => {
    const selected = selectBestProductTitle([
      { title: "AGAVE GREEN HEATHER S", source: "json_ld_product_name", confidence: "high" },
      { title: "Hawthorn Shirt", source: "embedded_product_title", confidence: "high" },
      { title: "Hawthorn Shirt | Tentree", source: "open_graph_title", confidence: "medium" },
    ]);
    expect(selected).toMatchObject({
      title: "Hawthorn Shirt",
      source: "embedded_product_title",
    });
  });

  test("product titles remove separated variant suffixes and storefront labels", () => {
    expect(selectBestProductTitle([
      { title: "Hawthorn Shirt - AGAVE GREEN HEATHER S", source: "embedded_product_title", confidence: "high" },
    ]).title).toBe("Hawthorn Shirt");
    expect(selectBestProductTitle([
      { title: "Vanson Wool Bomber Jacket Black | US", source: "open_graph_title", confidence: "medium" },
    ]).title).toBe("Vanson Wool Bomber Jacket");
  });

  test("Tentree-like mixed structured data selects the product title and active sale offer", () => {
    const metadata = extractProductMetadataFromHtml(
      "https://www.tentree.com/products/hawthorn-shirt-agave-green-heather",
      `<meta property="og:locale" content="en_US" />
       <meta property="og:title" content="Hawthorn Shirt | Tentree" />
       <script type="application/ld+json">{
         "@type":"Product",
         "name":"AGAVE GREEN HEATHER S",
         "offers":{"@type":"Offer","price":"20","priceCurrency":"USD"}
       }</script>
       <script type="application/json">{"product":{
         "title":"Hawthorn Shirt",
         "vendor":"Tentree",
         "salePrice":"54.40",
         "regularPrice":"68.00",
         "currency":"USD",
         "images":["https://cdn.shopify.com/products/hawthorn-shirt-main.jpg"]
       }}</script>`,
    );
    expect(metadata).toMatchObject({
      title: "Hawthorn Shirt",
      priceAmount: 54.4,
      salePrice: 54.4,
      originalPrice: 68,
      priceCurrency: "USD",
      titleSource: "embedded_product_title",
      priceSource: "embedded_product_price",
    });
  });

  test("explicit AllSaints product title outranks a generated description", () => {
    const selected = selectBestProductTitle([
      { title: "Black loose striped jacket", source: "generated_image_description", confidence: "low" },
      { title: "Vanson Wool Bomber Jacket", source: "embedded_product_title", confidence: "high" },
    ]);
    expect(selected.title).toBe("Vanson Wool Bomber Jacket");
  });

  test("AllSaints-like page attributes do not overwrite an explicit product title", () => {
    const metadata = extractProductMetadataFromHtml(
      "https://www.allsaints.com/us/vanson-wool-bomber-jacket/USM001LF-5.html",
      `<meta property="og:title" content="Vanson Wool Bomber Jacket | AllSaints" />
       <meta property="og:image" content="https://media.i.allsaints.com/vanson-main.jpg" />
       <body>Black loose fit striped wool bomber jacket.</body>`,
    );
    expect(metadata.title).toBe("Vanson Wool Bomber Jacket");
  });

  test("AllSaints live-style storefront suffix and color are removed from the product title", () => {
    const metadata = extractProductMetadataFromHtml(
      "https://www.allsaints.com/us/vanson-wool-bomber-jacket/USM001LF-5.html",
      `<meta property="og:title" content="Vanson Wool Bomber Jacket Black | US" />
       <meta property="og:image" content="https://media.i.allsaints.com/vanson-main.jpg" />`,
    );
    expect(metadata.title).toBe("Vanson Wool Bomber Jacket");
  });

  test("price ranking prefers product evidence, storefront currency, and valid sale pricing", () => {
    const selected = selectBestProductPrice([
      {
        amount: 20,
        currency: "USD",
        source: "json_ld_offer",
        title: "AGAVE GREEN HEATHER S",
      },
      {
        amount: 68,
        salePrice: 54.4,
        originalPrice: 68,
        currency: "USD",
        source: "embedded_product_price",
        title: "Hawthorn Shirt",
        availability: "https://schema.org/InStock",
      },
      {
        amount: 45,
        currency: "GBP",
        source: "open_graph_price",
        title: "Hawthorn Shirt",
      },
    ], "USD");
    expect(selected).toMatchObject({
      amount: 54.4,
      salePrice: 54.4,
      originalPrice: 68,
      currency: "USD",
      source: "embedded_product_price",
    });
  });

  test("multiple JSON-LD offers prefer an available direct offer", () => {
    const result = extractStructuredData(
      `<script type="application/ld+json">{
        "@type":"Product",
        "name":"Training Shirt",
        "offers":[
          {"@type":"Offer","price":"45","priceCurrency":"GBP","availability":"https://schema.org/OutOfStock"},
          {"@type":"Offer","price":"26","priceCurrency":"USD","availability":"https://schema.org/InStock"}
        ]
      }</script>`,
      "https://example.com/products/training-shirt",
    );
    expect(result).toMatchObject({
      priceAmount: 26,
      currency: "USD",
      availability: "https://schema.org/InStock",
    });
  });

  test("authoritative storefront currency wins conflicting otherwise-equal offers", () => {
    const selected = selectBestProductPrice([
      { amount: 45, currency: "GBP", source: "embedded_product_price", title: "Training T-Shirt" },
      { amount: 26, currency: "USD", source: "embedded_product_price", title: "Training T-Shirt" },
    ], "USD");
    expect(selected.currency).toBe("USD");
    expect(selected.amount).toBe(26);
  });

  test("authoritative storefront currency fills a missing offer currency", () => {
    expect(selectBestProductPrice([
      { amount: 40.8, source: "embedded_product_price", title: "Hawthorn Shirt" },
    ], "USD")).toMatchObject({
      amount: 40.8,
      currency: "USD",
    });
  });

  test("Shopify storefront currency fills an offer that omits currency", () => {
    const metadata = extractProductMetadataFromHtml(
      "https://www.tentree.com/products/hawthorn-shirt-agave-green-heather",
      `<script>Shopify.currency = {"active":"USD","rate":"1.0"};</script>
       <script type="application/json">{"product":{
         "title":"Hawthorn Shirt - AGAVE GREEN HEATHER S",
         "price":"40.80",
         "images":["https://cdn.shopify.com/products/hawthorn-shirt-main.jpg"]
       }}</script>`,
    );
    expect(metadata).toMatchObject({
      title: "Hawthorn Shirt",
      priceAmount: 40.8,
      priceCurrency: "USD",
    });
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

  test("H&M fallback remains isolated and V2 stays disabled by default", () => {
    const preview = hmSanitizedClientPreview({
      sourceUrl: "https://www2.hm.com/en_us/productpage.0970819001.html",
      title: "Loose Fit Hoodie",
      imageUrl: "https://image.hm.com/assets/hm/product.jpg",
      imageUrls: ["https://image.hm.com/assets/hm/product.jpg"],
      description: null,
    });
    expect(canUseHmBlockedStorePreviewFallback(
      "https://www2.hm.com/en_us/productpage.0970819001.html",
      preview,
    )).toBe(true);
    expect(canUseHmBlockedStorePreviewFallback(
      "https://www.nike.com/t/example/ABC-123",
      preview,
    )).toBe(false);
    expect(isProductLinkExtractionV2Enabled({})).toBe(false);
  });
});
