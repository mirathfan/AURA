import {
  ProductLinkError,
  extractAmazonLinkData,
  extractColorFromProduct,
  inferBrand,
  inferClosetCategoryFromProduct,
  extractProductMetadataFromHtml,
  extractProductImagesFromHtml,
  looksLikeBlockedProductPage,
  isProductRedirectToStorefront,
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
import { filterReachableProductImageUrls, productCategoryHintsFromText } from "./auraCandidatePreview";
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
  test("classifies a crew neck pullover as a top through both preview and persistence", () => {
    expect(productCategoryHintsFromText("Accolade Crew Neck Pullover").category).toBe("top");
    expect(inferClosetCategoryFromProduct({ title: "Accolade Crew Neck Pullover" }).category).toBe("top");
  });
  test("retains collaboration identity and does not rebuild a title containing a slash color", () => {
    const alex = "<meta property=\"og:title\" content=\"J. Press x Alex Mill Rugby Striped Shirt In Cotton\"><meta property=\"product:brand\" content=\"Alex Mill\">";
    expect(extractProductMetadataFromHtml("https://alexmill.com/products/rugby", alex).title).toContain("J. Press x Alex Mill");
    const universal = "<script type=\"application/ld+json\">"+JSON.stringify({"@type":"Product",name:"Savvy Fine Knit V Sweater - Cream/Navy Stripes",color:["Cream/Navy Stripes"],brand:{name:"Universal Standard"}})+"</script>";
    expect(extractProductMetadataFromHtml("https://universalstandard.com/products/savvy", universal)).toMatchObject({title:"Savvy Fine Knit V Sweater - Cream Navy Stripes",color:"Cream/Navy Stripes"});
  });

  test("uses only the current Shopify product's unambiguous variant color", () => {
    const page = "https://ayr.com/products/the-distance-pant";
    const html = (handle: string, colors: string[]) => "<meta property=\"og:title\" content=\"The Distance Pant\"><script>var meta = "+JSON.stringify({product:{handle,variants:colors.map((color,i)=>({id:i+1,public_title:color+" / XS"}))}})+";</script>";
    expect(extractProductMetadataFromHtml(page,html("the-distance-pant",["Dirt","Dirt"])).color).toBe("Dirt");
    expect(extractProductMetadataFromHtml(page,html("recommendation",["Dirt"])).color).not.toBe("Dirt");
    expect(extractProductMetadataFromHtml(page,html("the-distance-pant",["Dirt","Ink"])).color).toBeFalsy();
    expect(extractProductMetadataFromHtml(page+"?variant=2",html("the-distance-pant",["Dirt","Ink"])).color).toBe("Ink");
    expect(extractProductMetadataFromHtml(page,html("the-distance-pant",["Charcoal / Charcoal"])).color).toBe("Charcoal");
  });

  test("reads named colors from retailers' explicit title sections", () => {
    const everlane="<meta property=\"og:title\" content=\"The Box-Cut Tee in Essential Cotton | Peyote | No Pocket\">";
    expect(extractProductMetadataFromHtml("https://everlane.com/products/tee",everlane).color).toBe("Peyote");
    const mumu="<meta property=\"og:title\" content=\"Valley Sweater ~ Arctic Chevron Knit\">";
    expect(extractProductMetadataFromHtml("https://showmeyourmumu.com/products/sweater",mumu).color).toBe("Arctic Chevron Knit");
    expect(extractProductMetadataFromHtml("https://example.com/products/sweater",mumu).color).toBeFalsy();
    const rails="<meta property=\"og:title\" content=\"BRADSHAW SHIRT - KELLY WHITE STRIPE\">";
    expect(extractProductMetadataFromHtml("https://rails.com/products/bradshaw-shirt-kelly-white-stripe",rails).color).toBe("Kelly White Stripe");
  });

  test("uses a ProductGroup identity with selected resale variant price and image", () => {
    const page="https://outerknown.com/products/jeans";
    const variant={"@type":"Product",name:"Jeans - Outerworn:Denim / 24 / listing-id",brand:{name:"Trove"},color:"Denim",image:"https://outerknown.com/jeans.jpg",offers:{url:page,price:100,priceCurrency:"USD"}};
    const html="<script type=\"application/ld+json\">"+JSON.stringify({"@type":"ProductGroup",name:"Dune High Rise Slim Fit Jeans",brand:{name:"Outerknown"},hasVariant:[variant]})+"</script>";
    expect(extractStructuredData(html,page)).toMatchObject({title:"Dune High Rise Slim Fit Jeans",brand:"Outerknown",color:"Denim",priceAmount:100});
  });
  test("preserves retailer color names and scopes the Madewell brand alias to its own site", () => {
    expect(extractColorFromProduct({ title: "Classic Organic Tee - Optical White" }).color).toBe("Optical White");
    expect(inferBrand({ brand: "MW" }, "www.madewell.com").brand).toBe("Madewell");
    expect(inferBrand({ brand: "MW" }, "example.com").brand).toBe("MW");
    expect(selectBestProductTitle([{title:"Classic Organic Tee - Optical White",source:"json_ld"}]).title).toBe("Classic Organic Tee");
  });

  test("Uniqlo uses the requested color, image and active local price from its product state", () => {
    const page = "https://www.uniqlo.com/us/en/products/E422992-000/00?colorDisplayCode=09";
    const black = "https://image.uniqlo.com/422992/item/usgoods_09_422992.jpg";
    const red = black.replace("_09_", "_16_");
    const state = {
      pdp: { product: "E422992-000-00" },
      entity: { pdpEntity: { "E422992-000-00": { product: {
        productId: "E422992-000", name: "Crew Neck T-Shirt",
        colors: [{ displayCode: "09", name: "BLACK" }],
        images: { main: { "09": { image: black }, "16": { image: red } } },
        prices: { base: { value: 24.9, currency: { code: "USD" } } },
      } } } },
    };
    const html = `<meta property="og:image" content="${red}"><script>window.__PRELOADED_STATE__ = ${JSON.stringify(state)}</script>`;
    expect(extractProductMetadataFromHtml(page, html)).toMatchObject({ color: "Black", priceAmount: 24.9, currency: "USD" });
    expect(extractProductImagesFromHtml(page, html)[0]).toBe(black);
  });

  test("Foot Locker selected swatch takes precedence over natural drape in the description", () => {
    const html = "<meta property=\"og:title\" content=\"Nike NSW Tee\"><meta name=\"description\" content=\"Cotton with natural drape.\"><p aria-live=\"polite\">Color Hydrogen Blue/Green is selected</p>";
    expect(extractProductMetadataFromHtml("https://www.footlocker.com/product/nike/R0606407.html", html).color).toBe("Hydrogen Blue/Green");
  });

  test("an explicitly checked color wins over generic fabric descriptions", () => {
    const html = `<meta property="og:title" content="Chalet Lounge Pant">
      <input name="Color" value="Brown"><input checked name="Color" value="Navy Twill">`;
    expect(extractProductMetadataFromHtml("https://www.marinelayer.com/products/chalet", html).color).toBe("Navy Twill");
  });

  test("removing a retailer color suffix leaves a complete garment name", () => {
    const page = "https://kotn.com/products/womens-pocket-cargo-pants-in-charcoal";
    const html = "<meta property=\"og:title\" content=\"Women's Pocket Cargo Pants in Charcoal\">";
    expect(extractProductMetadataFromHtml(page, html)).toMatchObject({ title: "Women's Pocket Cargo Pants", color: "Charcoal" });
  });

  test("Puma selected swatch wins over the first ProductGroup variant", () => {
    // Reduced from the live 689340?swatch=02 page: white is selected, black is first.
    const page = "https://us.puma.com/us/en/pd/ess-no--1-logo-tee-us-men/689340?swatch=02";
    const white = {
      "@type": "Product", name: "PUMA Essentials Men's Tee", color: "PUMA White",
      brand: { name: "PUMA" }, image: "https://images.puma.com/global/689340/02/mod01.png",
      offers: { url: page, price: 11.99, priceCurrency: "USD" },
    };
    const black = {
      ...white, color: "PUMA Black", image: "https://images.puma.com/global/689340/01/mod01.png",
      offers: { ...white.offers, url: page.replace("swatch=02", "swatch=01") },
    };
    const group = { "@type": "ProductGroup", name: white.name, hasVariant: [black, white] };
    for (const nodes of [[white, group], [group, white]]) {
      const html = `<script type="application/ld+json">${JSON.stringify(nodes)}</script>`;
      const result = extractStructuredData(html, page);
      expect(result.primaryImage).toBe(white.image);
      expect(result.color).toBe("PUMA White");
      expect(result.priceAmount).toBe(11.99);
    }
  });
  test("storefront redirects cannot supply promotional images as product images", () => {
    const product = new URL("https://www.colorfulstandard.com/products/organic-straight-leg-pants-deep-black-male");
    expect(isProductRedirectToStorefront(product, new URL("https://colorfulstandard.com/en-us"))).toBe(true);
    expect(isProductRedirectToStorefront(product, new URL("https://colorfulstandard.com/"))).toBe(true);
    expect(isProductRedirectToStorefront(product, new URL("https://colorfulstandard.com/en-us/products/organic-straight-leg-pants-deep-black-male"))).toBe(false);
    expect(isProductRedirectToStorefront(new URL("https://example.com/"), new URL("https://example.com/en-us"))).toBe(false);
  });

  test("child retailer domains take precedence and lookalike hosts stay generic", () => {
    expect(normalizeProductUrl("https://oldnavy.gap.com/browse/product.do?pid=6735870120210").retailer).toBe("Old Navy");
    expect(normalizeProductUrl("https://bananarepublic.gap.com/browse/product.do?pid=11894600120000").retailer).toBe("Banana Republic");
    expect(normalizeProductUrl("https://www.gap.com/browse/product.do?pid=7962558320001").retailer).toBe("Gap");
    expect(normalizeProductUrl("https://gap.com.example.org/products/shirt").retailer).toBeNull();
    expect(normalizeProductUrl("https://notgap.com/products/shirt").retailer).toBeNull();
    expect(normalizeProductUrl("https://us.puma.com/us/en/pd/tee/689340").retailer).toBe("Puma");
  });
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

  test("Amazon uses the selected mobile main image before other image metadata", () => {
    const selected = "https://m.media-amazon.com/images/I/selected.jpg";
    const result = extractAmazonLinkData(new URL("https://www.amazon.com/dp/B01KNM3EES"),
      `<title>Hanes charcoal tee</title><meta property="og:image" content="https://example.com/default.jpg">
       <h2 class="brand-insights-inline">Top Brand: Hanes <span></span></h2>
       <span id="inline-twister-expanded-dimension-text-color_name"> Charcoal Heather </span>
       <img src="https://example.com/advert.jpg"><img id="main-image" data-a-hires="${selected}">`);
    expect(result.imageUrls[0]).toBe(selected);
    expect(result.metadata.brand).toBe("Hanes");
    expect(result.metadata.color).toBe("Charcoal Heather");
  });

  test("recognizes the Macy's access challenge on an HTTP 200 response", () => {
    expect(looksLikeBlockedProductPage("<div id='sec-if-cpt-container'></div>")).toBe(true);
  });

  test("recognizes an Amazon challenge form without rejecting a product mentioning captcha", () => {
    expect(looksLikeBlockedProductPage("<form method='get' action='/errors_page/validateCaptcha'>")).toBe(true);
    expect(looksLikeBlockedProductPage("<title>Hanes Tee</title><script src='/captcha.js'></script>")).toBe(false);
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
