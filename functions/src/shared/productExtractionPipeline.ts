import {
  type ProductLinkWarningCode,
  warningCodesForProductLinkDiagnostics,
} from "./productLinkRelease";

export type ProductExtractionImage = {
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  source?: string | null;
  selectedImageReason?: string | null;
};

export type ProductFieldConfidence = "high" | "medium" | "low" | "missing";

export type ProductExtractionDiagnostics = {
  normalizedDomain: string;
  adapterName: string | null;
  extractionSource: string | null;
  fieldsFound: string[];
  missingFields: string[];
  candidateImageCount: number;
  selectedImageReason: string | null;
  primaryImageHost: string | null;
  hadStructuredData: boolean;
  hadOpenGraph: boolean;
  hadEmbeddedState: boolean;
  hadRetailerAdapter: boolean;
  titleConfidence: ProductFieldConfidence;
  brandConfidence: ProductFieldConfidence;
  priceConfidence: ProductFieldConfidence;
  imageConfidence: ProductFieldConfidence;
  categoryConfidence: ProductFieldConfidence;
  extractionWarnings: string[];
  warningCodes: ProductLinkWarningCode[];
  titleSource?: string | null;
  priceSource?: string | null;
  currencySource?: string | null;
};

export type ProductExtractionResult = {
  title?: string | null;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
  price?: string | null;
  priceAmount?: number | null;
  salePrice?: number | null;
  originalPrice?: number | null;
  currency?: string | null;
  color?: string | null;
  sizes?: string[];
  selectedSize?: string | null;
  images?: ProductExtractionImage[];
  primaryImage?: string | null;
  canonicalUrl?: string | null;
  retailer?: string | null;
  sourceDomain?: string | null;
  description?: string | null;
  sku?: string | null;
  styleId?: string | null;
  productId?: string | null;
  availability?: string | null;
  extractionSource?: string | null;
  adapterName?: string | null;
  selectedImageReason?: string | null;
  confidence?: number | null;
  titleConfidence?: ProductFieldConfidence;
  brandConfidence?: ProductFieldConfidence;
  priceConfidence?: ProductFieldConfidence;
  imageConfidence?: ProductFieldConfidence;
  categoryConfidence?: ProductFieldConfidence;
  diagnostics?: ProductExtractionDiagnostics;
  priceUnavailable?: boolean;
  marketPriceUnavailable?: boolean;
  collection?: string | null;
  titleSource?: string | null;
  priceSource?: string | null;
  currencySource?: string | null;
  breadcrumbs?: string[];
  debug?: {
    sources: string[];
    warnings?: string[];
    imageCandidateCount?: number;
  };
};

export type NormalizedProductUrl = {
  url: URL;
  normalizedUrl: string;
  canonicalDomain: string;
  sourceDomain: string;
  retailerId: string | null;
  retailer: string | null;
  amazonAsin: string | null;
};

export type ProductExtractionContext = {
  url: URL;
  normalized: NormalizedProductUrl;
  html: string;
  structured: ProductExtractionResult;
  embedded: ProductExtractionResult;
  openGraph: ProductExtractionResult;
};

export interface RetailerAdapter {
  id: string;
  domains: string[];
  canHandle(url: URL): boolean;
  extract(ctx: ProductExtractionContext): Promise<Partial<ProductExtractionResult>> | Partial<ProductExtractionResult>;
}

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "msclkid",
  "irclickid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "referrer",
  "spm",
]);
const SAFE_STRIP_PARAMS = new Set(["ref"]);
const IMPORTANT_VARIANT_PARAMS = new Set([
  "asin",
  "th",
  "psc",
  "variant",
  "swatch",
  "ccode",
  "colordisplaycode",
  "variation",
  "color",
  "colour",
  "size",
  "style",
  "styleid",
  "style_id",
  "sku",
  "pid",
  "productid",
  "product_id",
  "id",
  "selected",
  "swatchcolor",
]);
const AMAZON_DOMAINS = [
  "amazon.com",
  "amazon.co.uk",
  "amazon.ca",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.co.jp",
  "amazon.com.au",
];
const RETAILERS: Array<{ id: string; label: string; domains: string[] }> = [
  { id: "hm", label: "H&M", domains: ["hm.com"] },
  { id: "zara", label: "Zara", domains: ["zara.com"] },
  { id: "nike", label: "Nike", domains: ["nike.com"] },
  { id: "fearofgod", label: "Fear of God", domains: ["fearofgod.com"] },
  { id: "allsaints", label: "AllSaints", domains: ["allsaints.com"] },
  { id: "macys", label: "Macy's", domains: ["macys.com"] },
  { id: "jdsports", label: "JD Sports", domains: ["jdsports.com", "jdsports.co.uk"] },
  { id: "footlocker", label: "Foot Locker", domains: ["footlocker.com", "footlocker.ca", "footlocker.eu"] },
  { id: "stockx", label: "StockX", domains: ["stockx.com"] },
  { id: "amazon", label: "Amazon", domains: AMAZON_DOMAINS },
  { id: "adidas", label: "Adidas", domains: ["adidas.com"] },
  { id: "uniqlo", label: "Uniqlo", domains: ["uniqlo.com"] },
  // These retailers use the shared structured-data/metadata extractor.
  // Registration identifies the store; it does not imply a verified import.
  { id: "gap", label: "Gap", domains: ["gap.com"] },
  { id: "oldnavy", label: "Old Navy", domains: ["oldnavy.gap.com", "oldnavy.com"] },
  { id: "bananarepublic", label: "Banana Republic", domains: ["bananarepublic.gap.com", "bananarepublic.com"] },
  { id: "puma", label: "Puma", domains: ["puma.com"] },
  { id: "cos", label: "COS", domains: ["cos.com"] },
  { id: "madewell", label: "Madewell", domains: ["madewell.com"] },
  { id: "everlane", label: "Everlane", domains: ["everlane.com"] },
  { id: "taylorstitch", label: "Taylor Stitch", domains: ["taylorstitch.com"] },
  { id: "marinelayer", label: "Marine Layer", domains: ["marinelayer.com"] },
  { id: "kotn", label: "Kotn", domains: ["kotn.com"] },
  { id: "colorfulstandard", label: "Colorful Standard", domains: ["colorfulstandard.com"] },
  { id: "alo", label: "Alo Yoga", domains: ["aloyoga.com"] },
  { id: "tentree", label: "tentree", domains: ["tentree.com"] },
  { id: "alexmill", label: "Alex Mill", domains: ["alexmill.com"] },
  { id: "outerknown", label: "Outerknown", domains: ["outerknown.com"] },
  { id: "ayr", label: "AYR", domains: ["ayr.com"] },
  { id: "goodamerican", label: "Good American", domains: ["goodamerican.com"] },
  { id: "reigningchamp", label: "Reigning Champ", domains: ["reigningchamp.com"] },
  { id: "rails", label: "Rails", domains: ["rails.com"] },
  { id: "draperjames", label: "Draper James", domains: ["draperjames.com"] },
  { id: "faherty", label: "Faherty", domains: ["fahertybrand.com"] },
  { id: "showmeyourmumu", label: "Show Me Your Mumu", domains: ["showmeyourmumu.com"] },
  { id: "universalstandard", label: "Universal Standard", domains: ["universalstandard.com"] },
];

type JsonObject = Record<string, unknown>;

/*
 * Generic ecommerce extraction is intentionally best-effort. It reads structured
 * metadata, bounded embedded JSON, and lightweight adapter cleanup; it is not a
 * JavaScript runtime and adapters are not full site scrapers. Some sites block
 * server fetches. Amazon price/availability are only trusted from reliable
 * structured/API-like data, and StockX market prices are never fabricated.
 */

function cleanText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maxLength) : null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/&#(\d+);/g, (_match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalizedHost(host: string) {
  return host.toLowerCase().replace(/^(?:www\d*|m|mobile)\./, "");
}

function hostMatches(host: string, domains: string[]) {
  const normalized = normalizedHost(host);
  return domains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

function retailerForHost(host: string) {
  // A child store such as oldnavy.gap.com must win over its parent gap.com.
  return RETAILERS
    .flatMap((retailer) => retailer.domains
      .filter((domain) => hostMatches(host, [domain]))
      .map((domain) => ({ retailer, specificity: domain.length })))
    .sort((a, b) => b.specificity - a.specificity)[0]?.retailer ?? null;
}

export function amazonAsinFromProductUrl(url: URL): string | null {
  const pathMatch = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?]|$)|\/exec\/obidos\/ASIN\/([A-Z0-9]{10})(?:[/?]|$)/i);
  if (pathMatch?.[1] || pathMatch?.[2]) return (pathMatch[1] ?? pathMatch[2]).toUpperCase();
  for (const key of ["asin", "ASIN", "pd_rd_i"]) {
    const value = url.searchParams.get(key);
    if (value && /^[A-Z0-9]{10}$/i.test(value)) return value.toUpperCase();
  }
  return null;
}

export function normalizeProductUrl(rawUrl: string | URL): NormalizedProductUrl {
  const url = new URL(rawUrl.toString());
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  url.hash = "";
  const retailer = retailerForHost(url.hostname);
  const amazonAsin = retailer?.id === "amazon" ? amazonAsinFromProductUrl(url) : null;
  const hostBeforeCanonical = url.hostname;
  const canonicalHost = normalizedHost(hostBeforeCanonical);
  if (/^(?:m|mobile)\./i.test(hostBeforeCanonical) && retailer?.domains.includes(canonicalHost)) {
    url.hostname = canonicalHost;
  }

  for (const key of Array.from(url.searchParams.keys())) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || TRACKING_PARAMS.has(lower)) {
      url.searchParams.delete(key);
      continue;
    }
    if (SAFE_STRIP_PARAMS.has(lower) && !IMPORTANT_VARIANT_PARAMS.has(lower)) {
      url.searchParams.delete(key);
    }
  }

  if (retailer?.id === "amazon" && amazonAsin) {
    url.pathname = `/dp/${amazonAsin}`;
    for (const key of Array.from(url.searchParams.keys())) {
      if (!["th", "psc"].includes(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
  }

  return {
    url,
    normalizedUrl: url.toString(),
    canonicalDomain: normalizedHost(url.hostname),
    sourceDomain: normalizedHost(url.hostname),
    retailerId: retailer?.id ?? null,
    retailer: retailer?.label ?? null,
    amazonAsin,
  };
}

function normalizeImageUrl(baseUrl: URL, value: unknown): string | null {
  const raw = cleanText(value, 1200);
  if (!raw || raw.startsWith("data:")) return null;
  try {
    const parsed = new URL(decodeHtmlEntities(raw), baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.protocol = "https:";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function imageKey(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(imwidth|width|height|w|h|sw|sh|q|quality|fit|fmt|format)$/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.toLowerCase()}`;
  } catch {
    return url.toLowerCase().replace(/([?&])(imwidth|width|height|w|h|sw|sh|q|quality)=\d+/gi, "$1");
  }
}

export function normalizeProductImages(
  images: Array<string | ProductExtractionImage | null | undefined>,
  pageUrl: URL,
  source: string,
): ProductExtractionImage[] {
  const deduped = new Map<string, ProductExtractionImage>();
  for (const image of images) {
    const rawUrl = typeof image === "string" ? image : image?.url;
    const url = normalizeImageUrl(pageUrl, rawUrl);
    if (!url || /\s/.test(url)) continue;
    const key = imageKey(url);
    const next: ProductExtractionImage = {
      ...(typeof image === "string" ? {} : image),
      url,
      source: typeof image === "string" ? source : image?.source ?? source,
    };
    const existing = deduped.get(key);
    if (!existing || imageRankScore(next) > imageRankScore(existing)) {
      deduped.set(key, next);
    }
  }
  return Array.from(deduped.values());
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    if (value > 1000 && Number.isInteger(value)) return Math.round(value) / 100;
    return Math.round(value * 100) / 100;
  }
  const text = cleanText(value, 120);
  if (!text) return null;
  const match = text.match(/\d[\d,.]*/);
  if (!match) return null;
  let numeric = match[0];
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    numeric =
      lastComma > lastDot
        ? numeric.replace(/\./g, "").replace(",", ".")
        : numeric.replace(/,/g, "");
  } else if (lastComma >= 0) {
    numeric = numeric.length - lastComma - 1 === 2 ? numeric.replace(",", ".") : numeric.replace(/,/g, "");
  }
  const amount = Number(numeric.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function currencyFromText(...values: unknown[]) {
  const text = values.map((value) => cleanText(value, 80) ?? "").join(" ").toUpperCase();
  const iso = text.match(/\b(USD|CAD|GBP|EUR|AUD|JPY|INR)\b/)?.[1];
  if (iso) return iso;
  if (text.includes("£")) return "GBP";
  if (text.includes("€")) return "EUR";
  if (text.includes("CA$") || text.includes("C$")) return "CAD";
  if (text.includes("AU$") || text.includes("A$")) return "AUD";
  if (text.includes("¥")) return "JPY";
  if (text.includes("$")) return "USD";
  return null;
}

function priceDisplay(amount: number | null, currency: string | null, raw?: unknown) {
  const direct = cleanText(raw, 80);
  if (direct && /\d/.test(direct)) return direct;
  if (amount == null) return null;
  return currency ? `${currency} ${amount}` : String(amount);
}

function confidenceFor(value: unknown, confidence: ProductFieldConfidence): ProductFieldConfidence {
  return isMeaningful(value) ? confidence : "missing";
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function jsonTypeIncludes(value: unknown, typeName: string) {
  return asArray(value).some((entry) => String(entry).toLowerCase() === typeName.toLowerCase());
}

function tryParseJson(text: string): unknown | null {
  const body = decodeHtmlEntities(text)
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/,\s*([}\]])/g, "$1");
  if (!body || (!body.startsWith("{") && !body.startsWith("["))) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function flattenJsonLd(value: unknown): JsonObject[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const object = asObject(value);
  if (!object) return [];
  return [object, ...flattenJsonLd(object["@graph"]), ...flattenJsonLd(object.hasVariant)];
}

function parseJsonLdBlocks(html: string): { values: unknown[]; warnings: string[] } {
  const values: unknown[] = [];
  const warnings: string[] = [];
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html))) {
    const parsed = tryParseJson(match[1] ?? "");
    if (parsed) values.push(parsed);
    else warnings.push("malformed_json_ld");
  }
  return { values, warnings };
}

function valueByKeys(object: JsonObject | null | undefined, keys: string[]) {
  if (!object) return undefined;
  for (const key of keys) {
    if (object[key] != null) return object[key];
  }
  return undefined;
}

function brandFromNode(node: JsonObject | null): string | null {
  const brand = valueByKeys(node, ["brand", "manufacturer"]);
  if (typeof brand === "string") return cleanText(brand, 120);
  const brandObject = asObject(brand);
  return cleanText(valueByKeys(brandObject, ["name", "brandName"]), 120);
}

function imagesFromUnknown(value: unknown, pageUrl: URL, source: string): ProductExtractionImage[] {
  const out: ProductExtractionImage[] = [];
  for (const entry of asArray(value)) {
    if (typeof entry === "string") {
      const url = normalizeImageUrl(pageUrl, entry);
      if (url) out.push({ url, source });
      continue;
    }
    const object = asObject(entry);
    if (!object) continue;
    const url = normalizeImageUrl(pageUrl, valueByKeys(object, ["url", "src", "contentUrl", "imageUrl", "href"]));
    if (url) {
      out.push({
        url,
        altText: cleanText(valueByKeys(object, ["alt", "altText", "title", "label"]), 180),
        width: parseAmount(object.width),
        height: parseAmount(object.height),
        source,
      });
    }
  }
  return out;
}

function offerFromProduct(product: JsonObject | null): JsonObject | null {
  const offers = asArray(product?.offers).map((entry) => asObject(entry)).filter((entry): entry is JsonObject => !!entry);
  return offers[0] ?? asObject(product?.offers);
}

function priceFromOffer(product: JsonObject | null) {
  const offers = asArray(product?.offers)
    .map((entry) => asObject(entry))
    .filter((entry): entry is JsonObject => !!entry);
  const candidates = (offers.length ? offers : [product ?? {}]).map((offer, index) => {
    const aggregate = jsonTypeIncludes(offer["@type"], "AggregateOffer") ? offer : null;
    const priceValue = aggregate?.lowPrice ?? offer.price ?? offer.priceSpecification ?? product?.price;
    const priceSpec = asObject(priceValue);
    const amount = parseAmount(priceSpec?.price ?? priceValue);
    const currency =
      cleanText(aggregate?.priceCurrency ?? offer.priceCurrency ?? priceSpec?.priceCurrency ?? product?.priceCurrency, 12) ??
      currencyFromText(priceValue);
    const availability = cleanText(offer.availability ?? aggregate?.availability, 120);
    let score = amount == null ? -100 : 0;
    if (offer.price != null || priceSpec?.price != null) score += 25;
    if (currency) score += 15;
    if (/instock|limitedavailability/i.test(availability ?? "")) score += 12;
    if (/outofstock|soldout|discontinued/i.test(availability ?? "")) score -= 20;
    if (aggregate) score -= 3;
    return {
      amount,
      currency,
      display: priceDisplay(amount, currency, priceValue),
      availability,
      lowPrice: parseAmount(aggregate?.lowPrice),
      highPrice: parseAmount(aggregate?.highPrice),
      score,
      index,
    };
  });
  const selected = candidates.sort((a, b) => b.score - a.score || a.index - b.index)[0];
  return {
    amount: selected?.amount ?? null,
    currency: selected?.currency ?? null,
    display: selected?.display ?? null,
    availability: selected?.availability ?? null,
    lowPrice: selected?.lowPrice ?? null,
    highPrice: selected?.highPrice ?? null,
  };
}

function breadcrumbNames(nodes: JsonObject[]) {
  const breadcrumb = nodes.find((node) => jsonTypeIncludes(node["@type"], "BreadcrumbList"));
  const items = asArray(breadcrumb?.itemListElement);
  return items
    .map((entry) => {
      const object = asObject(entry);
      return cleanText(object?.name ?? asObject(object?.item)?.name, 120);
    })
    .filter((entry): entry is string => !!entry);
}

function resultFromProductNode(product: JsonObject, pageUrl: URL, nodes: JsonObject[]): ProductExtractionResult {
  const price = priceFromOffer(product);
  const breadcrumbs = breadcrumbNames(nodes);
  const images = normalizeProductImages(
    [
      ...imagesFromUnknown(product.image, pageUrl, "structured_data"),
      ...imagesFromUnknown(valueByKeys(product, ["images", "photo", "thumbnail"]), pageUrl, "structured_data"),
    ],
    pageUrl,
    "structured_data",
  );
  return {
    title: cleanText(valueByKeys(product, ["name", "headline", "title"]), 220),
    titleSource: "json_ld_product_name",
    brand: brandFromNode(product),
    color: cleanText(Array.isArray(product.color) && product.color.length === 1 ? product.color[0] : product.color, 120),
    category: cleanText(product.category ?? breadcrumbs[breadcrumbs.length - 2] ?? breadcrumbs[breadcrumbs.length - 1], 120),
    subcategory: cleanText(breadcrumbs[breadcrumbs.length - 1], 120),
    description: cleanText(product.description, 900),
    sku: cleanText(valueByKeys(product, ["sku", "mpn", "gtin", "gtin13"]), 120),
    styleId: cleanText(valueByKeys(product, ["mpn", "styleId", "styleID"]), 120),
    productId: cleanText(valueByKeys(product, ["productID", "productId", "id"]), 120),
    price: price.display,
    priceAmount: price.amount,
    currency: price.currency,
    priceSource: price.amount != null ? "json_ld_offer" : null,
    currencySource: price.currency ? "json_ld_offer" : null,
    availability: price.availability,
    images,
    primaryImage: images[0]?.url ?? null,
    canonicalUrl: normalizeImageUrl(pageUrl, offerFromProduct(product)?.url ?? product.url) ?? pageUrl.toString(),
    extractionSource: "structured_data",
    selectedImageReason: images.length ? "structured_data_primary_image" : null,
    confidence: 0.86,
    titleConfidence: confidenceFor(valueByKeys(product, ["name", "headline", "title"]), "high"),
    brandConfidence: confidenceFor(brandFromNode(product), "high"),
    priceConfidence: confidenceFor(price.amount, "high"),
    imageConfidence: confidenceFor(images, "high"),
    categoryConfidence: confidenceFor(product.category ?? breadcrumbs.length, "high"),
    breadcrumbs,
    debug: { sources: ["structured_data"] },
  };
}

export function extractStructuredData(html: string, pageUrl: string | URL): ProductExtractionResult {
  const url = new URL(pageUrl.toString());
  const { values, warnings } = parseJsonLdBlocks(html);
  const nodes = values.flatMap(flattenJsonLd);
  const selectedProduct = nodes.find((node) => {
    if (!jsonTypeIncludes(node["@type"], "Product")) return false;
    const candidates = [node.url, ...asArray(node.offers).map((offer) => asObject(offer)?.url)];
    return candidates.some((candidate) => {
      if (typeof candidate !== "string") return false;
      try {
        const productUrl = new URL(candidate, url);
        if (normalizedHost(productUrl.hostname) !== normalizedHost(url.hostname)) return false;
        const path = (value: URL) => value.pathname.replace(/\/$/, "");
        const variantParams = Array.from(url.searchParams.entries())
          .filter(([key]) => IMPORTANT_VARIANT_PARAMS.has(key.toLowerCase()));
        // Retailers may change the descriptive slug in their offer URL, but
        // the product ID and every requested variant must still agree.
        const sameProduct = path(productUrl) === path(url) ||
          (variantParams.length > 0 && path(productUrl).split("/").pop() === path(url).split("/").pop());
        return sameProduct && variantParams.every(([key, value]) => productUrl.searchParams.get(key) === value);
      } catch {
        return false;
      }
    });
  });
  const product =
    selectedProduct ??
    nodes.find((node) => jsonTypeIncludes(node["@type"], "ProductGroup")) ??
    nodes.find((node) => jsonTypeIncludes(node["@type"], "Product"));
  if (!product) {
    const breadcrumbs = breadcrumbNames(nodes);
    return {
      breadcrumbs,
      extractionSource: "structured_data",
      confidence: breadcrumbs.length ? 0.25 : 0,
      debug: { sources: breadcrumbs.length ? ["structured_data"] : [], warnings },
    };
  }
  const result = resultFromProductNode(product, url, nodes);
  // A variant owns its offer, image and color; the containing group owns the
  // garment identity (resale variants can contain listing IDs/provider names).
  const parent = selectedProduct && nodes.find((node) =>
    jsonTypeIncludes(node["@type"], "ProductGroup") && asArray(node.hasVariant).includes(selectedProduct));
  if (parent) {
    result.title = cleanText(parent.name, 220) ?? result.title;
    result.brand = brandFromNode(parent) ?? result.brand;
  }
  return {
    ...result,
    debug: {
      sources: ["structured_data"],
      warnings,
      imageCandidateCount: result.images?.length ?? 0,
    },
  };
}

export function readProductMetaContent(html: string, key: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = tag.match(/\s(?:name|property)\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (name?.toLowerCase() !== key.toLowerCase()) continue;
    const value = tag.match(/\scontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
    if (value) return decodeHtmlEntities(value);
  }
  return null;
}

function metaContent(html: string, key: string): string | null {
  return cleanText(readProductMetaContent(html, key), 800);
}

function titleTag(html: string) {
  const value = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return value ? cleanText(decodeHtmlEntities(value), 220) : null;
}

function canonicalProductUrl(pageUrl: URL, value: unknown) {
  const normalized = normalizeImageUrl(pageUrl, value);
  if (!normalized) return pageUrl.toString();
  try {
    const candidate = new URL(normalized);
    const pageLooksLikeProduct = /\/(?:products?|p|dp|shop\/product)\//i.test(pageUrl.pathname);
    if (pageLooksLikeProduct && candidate.pathname === "/") return pageUrl.toString();
    return candidate.toString();
  } catch {
    return pageUrl.toString();
  }
}

export function extractOpenGraph(html: string, pageUrl: string | URL): ProductExtractionResult {
  const url = new URL(pageUrl.toString());
  const image = metaContent(html, "og:image") ?? metaContent(html, "og:image:secure_url") ?? metaContent(html, "twitter:image") ?? metaContent(html, "twitter:image:src");
  const images = normalizeProductImages([image], url, "open_graph");
  const amount = parseAmount(metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount"));
  const currency =
    cleanText(metaContent(html, "product:price:currency") ?? metaContent(html, "og:price:currency"), 12) ??
    currencyFromText(metaContent(html, "product:price:amount"), metaContent(html, "og:price:amount"));
  const canonical = canonicalProductUrl(url, metaContent(html, "og:url"));
  const ogTitle = metaContent(html, "og:title");
  const twitterTitle = metaContent(html, "twitter:title");
  const pageTitle = titleTag(html);
  return {
    title: ogTitle ?? twitterTitle ?? pageTitle,
    titleSource: ogTitle ? "open_graph_title" : twitterTitle ? "twitter_title" : pageTitle ? "page_title" : null,
    description: metaContent(html, "og:description") ?? metaContent(html, "twitter:description") ?? metaContent(html, "description"),
    brand: metaContent(html, "product:brand") ?? metaContent(html, "brand"),
    price: priceDisplay(amount, currency, metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount")),
    priceAmount: amount,
    currency,
    priceSource: amount != null ? "open_graph_price" : null,
    currencySource: currency ? "open_graph_price" : null,
    availability: metaContent(html, "product:availability") ?? metaContent(html, "og:availability"),
    color: metaContent(html, "product:color") ?? metaContent(html, "color"),
    images,
    primaryImage: images[0]?.url ?? null,
    canonicalUrl: canonical,
    extractionSource: "open_graph",
    selectedImageReason: images.length ? "open_graph_fallback_image" : null,
    confidence: images.length || amount || metaContent(html, "og:title") ? 0.55 : 0,
    titleConfidence: confidenceFor(metaContent(html, "og:title") ?? metaContent(html, "twitter:title") ?? titleTag(html), "medium"),
    brandConfidence: confidenceFor(metaContent(html, "product:brand") ?? metaContent(html, "brand"), "medium"),
    priceConfidence: confidenceFor(amount, "medium"),
    imageConfidence: confidenceFor(images, "medium"),
    categoryConfidence: "missing",
    debug: { sources: images.length || amount || metaContent(html, "og:title") ? ["open_graph"] : [] },
  };
}

function extractScriptBodies(html: string) {
  const bodies: Array<{ attrs: string; body: string }> = [];
  const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html))) {
    if (bodies.length >= 45) break;
    const body = (match[2] ?? "").trim();
    if (!body || body.length > 300_000) continue;
    bodies.push({ attrs: match[1] ?? "", body });
  }
  return bodies;
}

function balancedJsonAfterAssignment(script: string, names: string[]) {
  for (const name of names) {
    const index = script.indexOf(name);
    if (index < 0) continue;
    const start = script.indexOf("{", index);
    if (start < 0) continue;
    let depth = 0;
    let inString = false;
    let quote = "";
    let escaped = false;
    for (let i = start; i < Math.min(script.length, start + 250_000); i++) {
      const char = script[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === quote) {
          inString = false;
        }
        continue;
      }
      if (char === "\"" || char === "'") {
        inString = true;
        quote = char;
      } else if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) return script.slice(start, i + 1);
      }
    }
  }
  return null;
}

export function currentShopifyProductColor(html: string, pageUrl: URL): string | null {
  for (const script of extractScriptBodies(html)) {
    const json = balancedJsonAfterAssignment(script.body, ["var meta =", "ShopifyAnalytics.meta ="]);
    const product = asObject(asObject(json ? tryParseJson(json) : null)?.product);
    if (!product || pageUrl.pathname.split("/products/")[1]?.replace(/\/$/, "") !== product.handle) continue;
    const requested = pageUrl.searchParams.get("variant");
    const variants = asArray(product.variants).map(asObject).filter((v): v is JsonObject => !!v);
    const colors = variants.filter((v) => !requested || String(v.id) === requested).map((v) => {
      const title = cleanText(v.public_title, 120);
      // Shopify separates option values with spaced slashes; preserve slashes
      // within a color name, e.g. Royal/Green. Only strip a recognized size.
      return title?.match(/^(.+?)\s+\/\s+(?:XXS|XS|SM|S|MD|M|LG|L|XL|XXL|[1-5]XL|\d{1,2})$/i)?.[1] ?? null;
    });
    if (colors.length && colors.every((color) => color && color === colors[0])) {
      const color = colors[0]!;
      const parts = color.split(/\s+\/\s+/);
      return parts.every((part) => part.toLowerCase() === parts[0].toLowerCase()) ? parts[0] : color;
    }
  }
  return null;
}

function collectJsonPayloads(html: string) {
  const payloads: unknown[] = [];
  let attempts = 0;
  for (const script of extractScriptBodies(html)) {
    const attrs = script.attrs.toLowerCase();
    const body = decodeHtmlEntities(script.body);
    if (attrs.includes("__next_data__") || attrs.includes("application/json")) {
      const parsed = tryParseJson(body);
      if (parsed) payloads.push(parsed);
      attempts++;
    }
    const assignment = balancedJsonAfterAssignment(body, [
      "window.__INITIAL_STATE__",
      "window.__PRELOADED_STATE__",
      "window.__APOLLO_STATE__",
      "window.__PRODUCT__",
      "__NUXT__",
      "product",
    ]);
    if (assignment && attempts < 28) {
      const parsed = tryParseJson(assignment);
      if (parsed) payloads.push(parsed);
      attempts++;
    }
    if (attempts >= 28) break;
  }
  return payloads;
}

function flattenObjects(value: unknown, limit = 350): JsonObject[] {
  const out: JsonObject[] = [];
  const visit = (entry: unknown) => {
    if (out.length >= limit) return;
    if (Array.isArray(entry)) {
      for (const item of entry.slice(0, 80)) visit(item);
      return;
    }
    const object = asObject(entry);
    if (!object) return;
    out.push(object);
    for (const next of Object.values(object).slice(0, 80)) visit(next);
  };
  visit(value);
  return out;
}

function productObjectScore(object: JsonObject) {
  let score = 0;
  if (valueByKeys(object, ["name", "title", "productName", "fullTitle"])) score += 35;
  if (valueByKeys(object, ["images", "image", "media", "galleryImages", "productImages", "featured_image", "featuredImage"])) score += 35;
  if (valueByKeys(object, ["variants", "skus", "sizes", "sizeOptions"])) score += 12;
  if (valueByKeys(object, ["price", "salePrice", "currentPrice", "priceInfo"])) score += 12;
  if (valueByKeys(object, ["sku", "styleId", "styleID", "productId", "productID", "id"])) score += 8;
  return score;
}

function extractSizes(object: JsonObject): string[] {
  const raw = [
    ...asArray(valueByKeys(object, ["sizes", "availableSizes", "sizeOptions"])),
    ...asArray(object.variants).map((variant) => valueByKeys(asObject(variant), ["size", "sizeName", "option1", "displaySize"])),
    ...asArray(object.skus).map((sku) => valueByKeys(asObject(sku), ["size", "sizeName", "displaySize"])),
  ];
  return Array.from(new Set(raw.map((entry) => cleanText(entry, 40)).filter((entry): entry is string => !!entry))).slice(0, 24);
}

function extractObjectImages(object: JsonObject, pageUrl: URL, source: string) {
  const imageSources = [
    valueByKeys(object, ["images", "image", "media", "galleryImages", "productImages", "photos"]),
    valueByKeys(object, ["featured_image", "featuredImage", "primaryImage", "imageUrl", "image_url"]),
    ...asArray(object.variants).flatMap((variant) => [
      valueByKeys(asObject(variant), ["image", "images", "featured_image", "imageUrl"]),
    ]),
  ];
  return normalizeProductImages(imageSources.flatMap((entry) => imagesFromUnknown(entry, pageUrl, source)), pageUrl, source);
}

function resultFromProductObject(object: JsonObject, pageUrl: URL, source: string): ProductExtractionResult {
  const priceObject = asObject(valueByKeys(object, ["priceInfo", "priceRange", "pricing"]));
  const explicitSalePrice = parseAmount(valueByKeys(object, ["salePrice", "sale_price", "currentPrice", "current_price"]) ?? priceObject?.salePrice);
  const amount = explicitSalePrice ?? parseAmount(valueByKeys(object, ["price", "regularPrice", "listPrice"]) ?? priceObject?.price ?? priceObject?.currentPrice);
  const originalPrice = parseAmount(
    valueByKeys(object, ["compare_at_price", "compareAtPrice", "originalPrice", "wasPrice"]) ??
      (explicitSalePrice != null ? valueByKeys(object, ["regularPrice", "listPrice"]) : null) ??
      priceObject?.originalPrice,
  );
  const salePrice = explicitSalePrice ?? (amount != null && originalPrice != null && amount < originalPrice ? amount : null);
  const currency =
    cleanText(valueByKeys(object, ["currency", "priceCurrency"]) ?? priceObject?.currency, 12) ??
    currencyFromText(valueByKeys(object, ["price", "priceDisplay"]));
  const images = extractObjectImages(object, pageUrl, source);
  return {
    title: cleanText(valueByKeys(object, ["name", "title", "productName", "fullTitle"]), 220),
    titleSource: "embedded_product_title",
    brand: cleanText(valueByKeys(object, ["brand", "brandName", "vendor", "designerName"]) ?? brandFromNode(object), 120),
    color: cleanText(valueByKeys(object, ["color", "colour", "colorName", "selectedColor", "colorway"]), 120),
    description: cleanText(valueByKeys(object, ["description", "shortDescription", "longDescription"]), 900),
    sku: cleanText(valueByKeys(object, ["sku", "masterSku", "styleNumber"]), 120),
    styleId: cleanText(valueByKeys(object, ["styleId", "styleID", "styleNumber", "mpn"]), 120),
    productId: cleanText(valueByKeys(object, ["productId", "productID", "id"]), 120),
    category: cleanText(valueByKeys(object, ["category", "categoryName", "productType"]), 120),
    subcategory: cleanText(valueByKeys(object, ["subcategory", "subCategory", "subCategoryName"]), 120),
    price: priceDisplay(amount, currency, valueByKeys(object, ["priceDisplay", "formattedPrice"])),
    priceAmount: amount,
    salePrice,
    originalPrice,
    currency,
    priceSource: amount != null ? "embedded_product_price" : null,
    currencySource: currency ? "embedded_product_price" : null,
    availability: cleanText(valueByKeys(object, ["availability", "stockStatus", "inventoryStatus"]), 120),
    sizes: extractSizes(object),
    images,
    primaryImage: images[0]?.url ?? null,
    canonicalUrl: normalizeImageUrl(pageUrl, valueByKeys(object, ["url", "canonicalUrl", "pdpUrl"])) ?? pageUrl.toString(),
    extractionSource: source,
    selectedImageReason: images.length ? "embedded_product_gallery_image" : null,
    confidence: productObjectScore(object) / 100,
    titleConfidence: confidenceFor(valueByKeys(object, ["name", "title", "productName", "fullTitle"]), "high"),
    brandConfidence: confidenceFor(valueByKeys(object, ["brand", "brandName", "vendor", "designerName"]) ?? brandFromNode(object), "high"),
    priceConfidence: confidenceFor(amount, "high"),
    imageConfidence: confidenceFor(images, "high"),
    categoryConfidence: confidenceFor(valueByKeys(object, ["category", "categoryName", "productType"]), "medium"),
    debug: { sources: [source], imageCandidateCount: images.length },
  };
}

export function extractEmbeddedAppState(html: string, pageUrl: string | URL): ProductExtractionResult {
  const url = new URL(pageUrl.toString());
  const payloads = collectJsonPayloads(html);
  const objects = payloads.flatMap((payload) => flattenObjects(payload));
  const candidates = objects
    .map((object) => ({ object, score: productObjectScore(object) }))
    .filter((entry) => entry.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  if (!candidates.length) return { extractionSource: "embedded_app_state", confidence: 0, debug: { sources: [] } };
  const results = candidates.map((candidate) => resultFromProductObject(candidate.object, url, "embedded_app_state"));
  return mergeExtractionResults(results, url, { defaultSource: "embedded_app_state" });
}

function isMeaningful(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return !!cleanText(value, 120);
}

function isConfidenceKey(key: keyof ProductExtractionResult) {
  return [
    "titleConfidence",
    "brandConfidence",
    "priceConfidence",
    "imageConfidence",
    "categoryConfidence",
  ].includes(key);
}

function hasExtractionEvidence(result: Partial<ProductExtractionResult>) {
  return [
    result.title,
    result.brand,
    result.category,
    result.subcategory,
    result.price,
    result.priceAmount,
    result.salePrice,
    result.originalPrice,
    result.currency,
    result.color,
    result.sizes,
    result.images,
    result.primaryImage,
    result.description,
    result.sku,
    result.styleId,
    result.productId,
    result.availability,
    result.breadcrumbs,
  ].some(isMeaningful);
}

const PRODUCT_TITLE_NOUN_RE = /\b(?:shirt|t-?shirt|tee|polo|hoodie|sweatshirt|sweater|jumper|cardigan|jacket|bomber|coat|blazer|trench|vest|tank|blouse|top|jeans|trousers|pants|shorts|skirt|dress|jumpsuit|romper|shoe|sneaker|trainer|boot|loafer|sandal|heel|bag|tote|backpack|wallet|belt|hat|cap|beanie|scarf|sunglasses|watch)\b/i;
const PRODUCT_SIZE_TOKEN_RE = /^(?:xxs|xs|s|m|l|xl|xxl|2xl|3xl|\d{1,2}(?:\.5)?|one\s+size)$/i;
const PRODUCT_COLOR_WORD_RE = /^(?:black|white|optical|grey|gray|blue|navy|green|red|pink|purple|brown|tan|beige|cream|ivory|yellow|orange|silver|gold|olive|khaki|charcoal|natural|heather|marl|agave|ecru|stone)$/i;

function cleanProductTitleVariantSuffix(value?: string | null) {
  let title = cleanText(value, 220);
  if (!title) return null;
  title = title.replace(/\s*\|\s*(?:US|USA|UK|CA|EU|AU|NZ)\s*$/i, "").trim();
  const separated = title.match(/^(.*?)\s+(?:-|–|—|\|)\s+(.+)$/);
  if (separated?.[1] && separated[2] && looksLikeProductVariantTitle(separated[2])) {
    title = separated[1].trim();
  }
  const words = title.split(/\s+/);
  if (PRODUCT_TITLE_NOUN_RE.test(title) && words.length > 2) {
    for (let suffixLength = Math.min(3, words.length - 2); suffixLength >= 1; suffixLength -= 1) {
      const suffix = words.slice(-suffixLength);
      if (suffix.every((word) => PRODUCT_COLOR_WORD_RE.test(word))) {
        title = words.slice(0, -suffixLength).join(" ").replace(/\s+in$/i, "");
        break;
      }
    }
  }
  return title;
}

export function looksLikeProductVariantTitle(value?: string | null) {
  const title = cleanText(value, 220);
  if (!title) return true;
  if (PRODUCT_TITLE_NOUN_RE.test(title)) return false;
  const words = title.split(/[\s/|_-]+/).filter(Boolean);
  if (!words.length) return true;
  if (words.every((word) => PRODUCT_SIZE_TOKEN_RE.test(word))) return true;
  if (PRODUCT_SIZE_TOKEN_RE.test(words[words.length - 1] ?? "")) return true;
  if (words.length <= 5 && words.every((word) => PRODUCT_COLOR_WORD_RE.test(word))) return true;
  return false;
}

function looksLikeSkuTitle(value?: string | null) {
  const title = cleanText(value, 220);
  if (!title) return true;
  if (/^[A-Z0-9]+(?:[-_/][A-Z0-9]+){1,4}$/i.test(title) && /\d/.test(title)) return true;
  return /^\d{5,}$/.test(title);
}

export function selectBestProductTitle(candidates: Array<{
  title?: string | null;
  source?: string | null;
  confidence?: ProductFieldConfidence;
}>) {
  const sourceWeight = (source?: string | null) => {
    const value = String(source ?? "").toLowerCase();
    if (value.includes("adapter")) return 110;
    if (value.includes("json_ld") || value.includes("structured")) return 100;
    if (value.includes("embedded") || value.includes("shopify")) return 95;
    if (value.includes("open_graph")) return 75;
    if (value.includes("twitter")) return 70;
    if (value.includes("page_title")) return 65;
    return 55;
  };
  const confidenceWeight: Record<ProductFieldConfidence, number> = {
    high: 15,
    medium: 8,
    low: 2,
    missing: -20,
  };
  const ranked = candidates
    .map((candidate, index) => {
      const title = cleanProductTitleVariantSuffix(candidate.title);
      if (!title) return null;
      let score = sourceWeight(candidate.source) + confidenceWeight[candidate.confidence ?? "low"];
      if (PRODUCT_TITLE_NOUN_RE.test(title)) score += 35;
      if (looksLikeProductVariantTitle(title)) score -= 95;
      if (looksLikeSkuTitle(title)) score -= 140;
      if (title.split(/\s+/).length >= 2) score += 5;
      return { title, source: candidate.source ?? null, confidence: candidate.confidence ?? "low", score, index };
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0] ?? { title: null, source: null, confidence: "missing" as ProductFieldConfidence, score: -1, index: -1 };
}

export function selectBestProductPrice(candidates: Array<{
  amount?: number | null;
  salePrice?: number | null;
  originalPrice?: number | null;
  currency?: string | null;
  source?: string | null;
  title?: string | null;
  availability?: string | null;
}>, preferredCurrency?: string | null) {
  const sourceWeight = (source?: string | null) => {
    const value = String(source ?? "").toLowerCase();
    if (value.includes("json_ld") || value.includes("structured")) return 100;
    if (value.includes("embedded") || value.includes("shopify")) return 90;
    if (value.includes("open_graph") || value.includes("meta")) return 70;
    if (value.includes("visible")) return 35;
    return 50;
  };
  const normalizedPreferredCurrency = cleanText(preferredCurrency, 12)?.toUpperCase() ?? null;
  const ranked = candidates
    .map((candidate, index) => {
      const baseAmount = typeof candidate.amount === "number" && Number.isFinite(candidate.amount) && candidate.amount > 0
        ? candidate.amount
        : null;
      const salePrice = typeof candidate.salePrice === "number" && candidate.salePrice > 0
        ? candidate.salePrice
        : null;
      const originalPrice = typeof candidate.originalPrice === "number" && candidate.originalPrice > 0
        ? candidate.originalPrice
        : null;
      const amount = salePrice ?? baseAmount;
      if (amount == null) return null;
      const currency = cleanText(candidate.currency, 12)?.toUpperCase() ?? null;
      let score = sourceWeight(candidate.source);
      if (currency) score += 12;
      if (normalizedPreferredCurrency && currency === normalizedPreferredCurrency) score += 24;
      if (normalizedPreferredCurrency && currency && currency !== normalizedPreferredCurrency) score -= 24;
      if (/instock|limitedavailability/i.test(candidate.availability ?? "")) score += 8;
      if (/outofstock|soldout|discontinued/i.test(candidate.availability ?? "")) score -= 15;
      if (looksLikeProductVariantTitle(candidate.title)) score -= 55;
      if (salePrice != null && originalPrice != null && salePrice < originalPrice) score += 10;
      return {
        amount,
        salePrice: salePrice != null && originalPrice != null && salePrice < originalPrice ? salePrice : null,
        originalPrice: originalPrice != null && originalPrice > amount ? originalPrice : null,
        currency,
        source: candidate.source ?? null,
        score,
        index,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = ranked[0] ?? {
    amount: null,
    salePrice: null,
    originalPrice: null,
    currency: null,
    source: null,
    score: -1,
    index: -1,
  };
  if (selected.currency || !normalizedPreferredCurrency || selected.amount == null) return selected;
  return { ...selected, currency: normalizedPreferredCurrency };
}

function mergeScalar<T extends keyof ProductExtractionResult>(
  target: ProductExtractionResult,
  source: ProductExtractionResult,
  key: T,
) {
  if (isConfidenceKey(key)) {
    const targetConfidence = target[key] as ProductFieldConfidence | undefined;
    const sourceConfidence = source[key] as ProductFieldConfidence | undefined;
    if ((!targetConfidence || targetConfidence === "missing") && sourceConfidence && sourceConfidence !== "missing") {
      target[key] = source[key] as ProductExtractionResult[T];
    } else if (!targetConfidence && sourceConfidence) {
      target[key] = source[key] as ProductExtractionResult[T];
    }
    return;
  }
  if (!isMeaningful(target[key]) && isMeaningful(source[key])) {
    target[key] = source[key] as ProductExtractionResult[T];
  }
}

export function mergeExtractionResults(
  results: Array<Partial<ProductExtractionResult> | null | undefined>,
  pageUrl: string | URL,
  options: { defaultSource?: string; preferredCurrency?: string | null } = {},
): ProductExtractionResult {
  const url = new URL(pageUrl.toString());
  const merged: ProductExtractionResult = {
    images: [],
    sizes: [],
    breadcrumbs: [],
    debug: { sources: [], warnings: [] },
  };
  for (const partial of results) {
    if (!partial) continue;
    const source = partial.extractionSource ?? partial.adapterName ?? options.defaultSource ?? "unknown";
    if (partial.debug?.sources?.length) {
      merged.debug?.sources.push(...partial.debug.sources);
    } else if (hasExtractionEvidence(partial)) {
      merged.debug?.sources.push(source);
    }
    if (partial.debug?.warnings?.length) merged.debug?.warnings?.push(...partial.debug.warnings);
    for (const key of [
      "title",
      "brand",
      "category",
      "subcategory",
      "price",
      "priceAmount",
      "salePrice",
      "originalPrice",
      "currency",
      "color",
      "selectedSize",
      "primaryImage",
      "canonicalUrl",
      "retailer",
      "sourceDomain",
      "description",
      "sku",
      "styleId",
      "productId",
      "availability",
      "extractionSource",
      "adapterName",
      "selectedImageReason",
      "confidence",
      "titleConfidence",
      "brandConfidence",
      "priceConfidence",
      "imageConfidence",
      "categoryConfidence",
      "priceUnavailable",
      "marketPriceUnavailable",
      "collection",
    ] as const) {
      mergeScalar(merged, partial as ProductExtractionResult, key);
    }
    merged.images?.push(
      ...normalizeProductImages(partial.images ?? (partial.primaryImage ? [partial.primaryImage] : []), url, source),
    );
    merged.sizes = Array.from(new Set([...(merged.sizes ?? []), ...(partial.sizes ?? [])])).slice(0, 32);
    merged.breadcrumbs = Array.from(new Set([...(merged.breadcrumbs ?? []), ...(partial.breadcrumbs ?? [])])).slice(0, 12);
  }
  const evidence = results.filter((result): result is ProductExtractionResult => !!result);
  const selectedTitle = selectBestProductTitle(evidence.map((result) => ({
    title: result.title,
    source: result.titleSource ?? result.extractionSource ?? result.adapterName,
    confidence: result.titleConfidence,
  })));
  if (selectedTitle.title) {
    merged.title = selectedTitle.title;
    merged.titleSource = selectedTitle.source;
    merged.titleConfidence = selectedTitle.confidence;
  }
  const selectedPrice = selectBestProductPrice(evidence.map((result) => ({
    amount: result.priceAmount,
    salePrice: result.salePrice,
    originalPrice: result.originalPrice,
    currency: result.currency,
    source: result.priceSource ?? result.extractionSource,
    title: result.title,
    availability: result.availability,
  })), options.preferredCurrency);
  if (selectedPrice.amount != null) {
    merged.priceAmount = selectedPrice.amount;
    merged.salePrice = selectedPrice.salePrice;
    merged.originalPrice = selectedPrice.originalPrice;
    merged.currency = selectedPrice.currency;
    merged.price = priceDisplay(selectedPrice.amount, selectedPrice.currency);
    merged.priceSource = selectedPrice.source;
    merged.currencySource = selectedPrice.currency ? selectedPrice.source : null;
  }
  merged.images = rankGenericProductImages(merged, url);
  merged.primaryImage = merged.images[0]?.url ?? merged.primaryImage ?? null;
  if (!merged.selectedImageReason && merged.primaryImage) {
    merged.selectedImageReason = merged.images[0]?.selectedImageReason ?? "generic_ranked_product_image";
  }
  merged.debug = {
    sources: Array.from(new Set(merged.debug?.sources ?? [])),
    warnings: Array.from(new Set(merged.debug?.warnings ?? [])),
    imageCandidateCount: merged.images.length,
  };
  return merged;
}

function imageDimensionHints(url: string) {
  const values: number[] = [];
  try {
    const parsed = new URL(url);
    for (const key of ["imwidth", "width", "w", "sw", "height", "h", "sh"]) {
      const value = Number(parsed.searchParams.get(key) ?? 0);
      if (Number.isFinite(value) && value > 0) values.push(value);
    }
  } catch {
    // Filename parsing below is enough for scoring.
  }
  for (const match of url.toLowerCase().matchAll(/(?:_|-|\/)(\d{2,4})(?:x|_|-)(\d{2,4})(?:[._/?-]|$)/g)) {
    values.push(Number(match[1]), Number(match[2]));
  }
  return values;
}

function imageRankScore(image: ProductExtractionImage, color?: string | null) {
  const lower = `${image.url} ${image.altText ?? ""}`.toLowerCase();
  let score = 0;
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(lower)) score += 8;
  if (/(product|pdp|gallery|main|primary|zoom|large|packshot|studio|image|photo)/i.test(lower)) score += 36;
  if (/(clean|cutout|transparent|isolated|white|plain|studio|packshot)/i.test(lower)) score += 28;
  if (color && lower.includes(color.toLowerCase())) score += 18;
  const dims = imageDimensionHints(image.url);
  const largest = Math.max(0, ...dims, image.width ?? 0, image.height ?? 0);
  if (largest >= 1200) score += 26;
  else if (largest >= 700) score += 16;
  else if (largest > 0 && largest < 300) score -= 55;
  if (/(logo|icon|sprite|favicon|badge|payment|klarna|afterpay|shipping|loader|placeholder|avatar)/i.test(lower)) score -= 180;
  if (/(banner|header|footer|promo|campaign|social|share|facebook|pinterest|instagram|og-image)/i.test(lower)) score -= 90;
  if (/(thumb|thumbnail|swatch|colorchip|small|tiny)/i.test(lower)) score -= 65;
  if (/(review|ugc|customer|user[-_\s]?generated)/i.test(lower)) score -= 80;
  if (/(model|lifestyle|editorial|on[-_\s]?body|on[-_\s]?foot|worn|wearing|lookbook)/i.test(lower)) score -= 22;
  if (/(detail|close[-_\s]?up|texture|material|macro|sole|outsole|box|packaging)/i.test(lower)) score -= 48;
  return score;
}

export function rankGenericProductImages(result: ProductExtractionResult, pageUrl: string | URL): ProductExtractionImage[] {
  const images = normalizeProductImages(result.images ?? [], new URL(pageUrl.toString()), "generic_ranked");
  const scored = images
    .map((image, index) => ({
      image,
      index,
      score: imageRankScore(image, result.color),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index || a.image.url.localeCompare(b.image.url));
  const usable = scored.filter((entry) => entry.score > -80);
  const ranked = (usable.length ? usable : scored.slice(0, 1))
    .map((entry, index) => ({
      ...entry.image,
      selectedImageReason:
        index === 0
          ? entry.image.selectedImageReason ?? selectedReasonForImageSource(entry.image.source)
          : entry.image.selectedImageReason ?? null,
    }));
  const hasLarge = ranked.some((image) => imageRankScore(image, result.color) >= 30);
  return hasLarge ? ranked.filter((image) => imageRankScore(image, result.color) > -20) : ranked;
}

function selectedReasonForImageSource(source?: string | null) {
  if (source === "structured_data") return "structured_data_primary_image";
  if (source === "open_graph") return "open_graph_fallback_image";
  if (source === "embedded_app_state") return "embedded_product_gallery_image";
  return "generic_ranked_product_image";
}

function safeImageHost(rawUrl?: string | null) {
  try {
    return rawUrl ? new URL(rawUrl).hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function resultHasSource(result: ProductExtractionResult, source: string) {
  return result.debug?.sources?.some((entry) => entry === source || entry.startsWith(`${source}:`)) ?? false;
}

function fieldNamesFound(result: ProductExtractionResult) {
  const checks: Array<[string, unknown]> = [
    ["title", result.title],
    ["brand", result.brand],
    ["category", result.category ?? result.subcategory],
    ["price", result.priceAmount ?? result.price],
    ["image", result.primaryImage ?? result.images],
    ["color", result.color],
    ["sizes", result.sizes],
    ["sku", result.sku ?? result.styleId ?? result.productId],
    ["availability", result.availability],
  ];
  return checks.filter(([, value]) => isMeaningful(value)).map(([key]) => key);
}

function missingFieldNames(result: ProductExtractionResult) {
  const required: Array<[string, unknown]> = [
    ["title", result.title],
    ["image", result.primaryImage ?? result.images],
    ["price", result.priceAmount ?? result.price],
    ["brand", result.brand],
    ["category", result.category ?? result.subcategory],
  ];
  return required.filter(([, value]) => !isMeaningful(value)).map(([key]) => key);
}

export function buildProductExtractionDiagnostics(
  result: ProductExtractionResult,
  normalized: NormalizedProductUrl,
): ProductExtractionDiagnostics {
  const fieldsFound = fieldNamesFound(result);
  const missingFields = missingFieldNames(result);
  const warnings = Array.from(new Set(result.debug?.warnings ?? []));
  const hasPrice = isMeaningful(result.priceAmount ?? result.price);
  if (!result.title) warnings.push("missing_title");
  if (!(result.primaryImage || result.images?.length)) warnings.push("missing_image");
  if (
    result.priceUnavailable ||
    result.marketPriceUnavailable ||
    (!hasPrice && (normalized.retailer === "Amazon" || result.retailer === "StockX"))
  ) {
    warnings.push("price_unavailable_conservative");
  } else if (!hasPrice) {
    warnings.push("missing_price");
  }
  const diagnostics = {
    normalizedDomain: normalized.canonicalDomain,
    adapterName: result.adapterName ?? null,
    extractionSource: result.extractionSource ?? null,
    fieldsFound,
    missingFields,
    candidateImageCount: result.images?.length ?? 0,
    selectedImageReason: result.selectedImageReason ?? result.images?.[0]?.selectedImageReason ?? null,
    primaryImageHost: safeImageHost(result.primaryImage ?? result.images?.[0]?.url),
    hadStructuredData: resultHasSource(result, "structured_data"),
    hadOpenGraph: resultHasSource(result, "open_graph"),
    hadEmbeddedState: resultHasSource(result, "embedded_app_state"),
    hadRetailerAdapter: result.debug?.sources?.some((entry) => entry.startsWith("adapter:")) ?? false,
    titleConfidence: result.titleConfidence ?? confidenceFor(result.title, "low"),
    brandConfidence: result.brandConfidence ?? confidenceFor(result.brand, "low"),
    priceConfidence:
      result.priceUnavailable || result.marketPriceUnavailable
        ? "missing"
        : result.priceConfidence ?? confidenceFor(result.priceAmount ?? result.price, "low"),
    imageConfidence: result.imageConfidence ?? confidenceFor(result.primaryImage ?? result.images, "low"),
    categoryConfidence: result.categoryConfidence ?? confidenceFor(result.category ?? result.subcategory, "low"),
    extractionWarnings: Array.from(new Set(warnings)),
    titleSource: result.titleSource ?? null,
    priceSource: result.priceSource ?? null,
    currencySource: result.currencySource ?? null,
  };
  return {
    ...diagnostics,
    warningCodes: warningCodesForProductLinkDiagnostics(diagnostics, [], result),
  };
}

function cleanupTitle(value?: string | null, retailer?: string | null) {
  let title = cleanText(value, 240);
  if (!title) return null;
  const labels = [retailer, "Fear of God", "AllSaints", "Macy's", "JD Sports", "Foot Locker", "StockX"]
    .filter((entry): entry is string => !!entry)
    .map((entry) => entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  for (const label of labels) {
    title = title
      .replace(new RegExp(`\\s*(?:\\||-|–)\\s*${label}\\s*$`, "i"), "")
      .replace(new RegExp(`^${label}\\s*(?:\\||-|–|:)\\s*`, "i"), "");
  }
  return title.trim();
}

function firstFromSources(ctx: ProductExtractionContext, key: keyof ProductExtractionResult) {
  if (key === "title") {
    return selectBestProductTitle([
      { title: ctx.structured.title, source: ctx.structured.titleSource ?? "structured_data", confidence: ctx.structured.titleConfidence },
      { title: ctx.embedded.title, source: ctx.embedded.titleSource ?? "embedded_app_state", confidence: ctx.embedded.titleConfidence },
      { title: ctx.openGraph.title, source: ctx.openGraph.titleSource ?? "open_graph", confidence: ctx.openGraph.titleConfidence },
    ]).title;
  }
  return ctx.structured[key] ?? ctx.embedded[key] ?? ctx.openGraph[key] ?? null;
}

function sourceText(ctx: ProductExtractionContext) {
  return `${ctx.structured.title ?? ""} ${ctx.embedded.title ?? ""} ${ctx.openGraph.title ?? ""} ${ctx.structured.description ?? ""} ${ctx.embedded.description ?? ""} ${ctx.openGraph.description ?? ""}`;
}

function colorFromText(text: string) {
  return cleanText(
    text.match(/\b(?:color|colour|colorway)\s*[:/-]\s*([A-Za-z][A-Za-z\s/-]{2,40})/i)?.[1] ??
      text.match(/\b(black|white|cream|grey|gray|blue|navy|green|red|pink|purple|brown|tan|beige|yellow|orange|silver|gold)\b/i)?.[1],
    80,
  );
}

function adapterResult(ctx: ProductExtractionContext, id: string, fields: Partial<ProductExtractionResult>): Partial<ProductExtractionResult> {
  const sourceConfidence: ProductFieldConfidence = ["amazon", "stockx"].includes(id) ? "medium" : "high";
  return {
    ...fields,
    adapterName: id,
    extractionSource: "retailer_adapter",
    titleSource: fields.title ? `adapter:${id}` : null,
    confidence: fields.confidence ?? 0.9,
    titleConfidence: fields.titleConfidence ?? confidenceFor(fields.title, sourceConfidence),
    brandConfidence: fields.brandConfidence ?? confidenceFor(fields.brand, sourceConfidence),
    priceConfidence: fields.priceUnavailable || fields.marketPriceUnavailable
      ? "missing"
      : fields.priceConfidence ?? confidenceFor(fields.priceAmount ?? fields.price, sourceConfidence),
    imageConfidence: fields.imageConfidence ?? confidenceFor(fields.images ?? fields.primaryImage, sourceConfidence),
    categoryConfidence: fields.categoryConfidence ?? confidenceFor(fields.category ?? fields.subcategory, sourceConfidence),
    debug: { sources: [`adapter:${id}`] },
  };
}

type UniqloProductState = {
  pdp?: { product?: string };
  selection?: Record<string, { colorDisplayCode?: string }>;
  entity?: { pdpEntity?: Record<string, { product?: {
    productId?: string;
    name?: string;
    colors?: { displayCode?: string; name?: string }[];
    images?: { main?: Record<string, { image?: string }> };
    prices?: { base?: UniqloPrice; promo?: UniqloPrice };
    breadcrumbs?: { category?: { locale?: string } };
  } }> };
};
type UniqloPrice = { value?: number; currency?: { code?: string } };

function uniqloSelectedProduct(ctx: ProductExtractionContext): Partial<ProductExtractionResult> {
  const match = ctx.html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/i);
  if (!match) return {};
  let state: UniqloProductState;
  try {
    state = JSON.parse(match[1]);
  } catch {
    return {};
  }
  const key = state?.pdp?.product;
  const product = key ? state.entity?.pdpEntity?.[key]?.product : null;
  if (!product?.productId || !ctx.url.pathname.split("/").includes(product.productId)) return {};
  const code = ctx.url.searchParams.get("colorDisplayCode") ?? state.selection?.[product.productId]?.colorDisplayCode;
  if (!code || !Array.isArray(product.colors)) return {};
  const color = cleanText(product.colors.find((entry) => entry.displayCode === code)?.name, 120);
  const image = normalizeImageUrl(ctx.url, product.images?.main?.[code]?.image);
  if (!color || !image) return {};
  const price = product.prices?.promo ?? product.prices?.base;
  return adapterResult(ctx, "uniqlo", {
    brand: "Uniqlo",
    title: cleanText(product.name, 220),
    color,
    category: cleanText(product.breadcrumbs?.category?.locale, 120),
    canonicalUrl: ctx.url.toString(),
    priceAmount: parseAmount(price?.value),
    currency: cleanText(price?.currency?.code, 3),
    images: [{ url: image, altText: color, source: "embedded_app_state", selectedImageReason: "selected_color_image" }],
  });
}

export const retailerAdapters: RetailerAdapter[] = [
  {
    id: "uniqlo",
    domains: ["uniqlo.com"],
    canHandle: (url) => hostMatches(url.hostname, ["uniqlo.com"]),
    extract: uniqloSelectedProduct,
  },
  {
    id: "hm",
    domains: ["hm.com"],
    canHandle: (url) => hostMatches(url.hostname, ["hm.com"]),
    extract: (ctx) =>
      adapterResult(ctx, "hm", {
        retailer: "H&M",
        brand: (firstFromSources(ctx, "brand") as string | null) ?? "H&M",
        title: cleanupTitle(firstFromSources(ctx, "title") as string | null, "H&M"),
        color: (firstFromSources(ctx, "color") as string | null) ?? colorFromText(sourceText(ctx)),
      }),
  },
  {
    id: "zara",
    domains: ["zara.com"],
    canHandle: (url) => hostMatches(url.hostname, ["zara.com"]),
    extract: (ctx) =>
      adapterResult(ctx, "zara", {
        retailer: "Zara",
        brand: (firstFromSources(ctx, "brand") as string | null) ?? "Zara",
        title: cleanupTitle(firstFromSources(ctx, "title") as string | null, "Zara"),
        color: (firstFromSources(ctx, "color") as string | null) ?? colorFromText(sourceText(ctx)),
      }),
  },
  {
    id: "nike",
    domains: ["nike.com"],
    canHandle: (url) => hostMatches(url.hostname, ["nike.com"]),
    extract: (ctx) =>
      adapterResult(ctx, "nike", {
        retailer: "Nike",
        brand: (firstFromSources(ctx, "brand") as string | null) ?? "Nike",
        title: cleanupTitle(firstFromSources(ctx, "title") as string | null, "Nike"),
        color: (firstFromSources(ctx, "color") as string | null) ?? colorFromText(sourceText(ctx)),
      }),
  },
  {
    id: "fearofgod",
    domains: ["fearofgod.com"],
    canHandle: (url) => hostMatches(url.hostname, ["fearofgod.com"]),
    extract: (ctx) => {
      const text = sourceText(ctx);
      const brand = /\bessentials\b/i.test(text) ? "Fear of God ESSENTIALS" : "Fear of God";
      return adapterResult(ctx, "fearofgod", {
        retailer: "Fear of God",
        brand,
        title: cleanupTitle(firstFromSources(ctx, "title") as string | null, "Fear of God"),
        color: (firstFromSources(ctx, "color") as string | null) ?? colorFromText(text),
        collection: cleanText(text.match(/\b(ESSENTIALS|Athletics|Fear of God)\b/i)?.[1], 80),
      });
    },
  },
  {
    id: "allsaints",
    domains: ["allsaints.com"],
    canHandle: (url) => hostMatches(url.hostname, ["allsaints.com"]),
    extract: (ctx) =>
      adapterResult(ctx, "allsaints", {
        retailer: "AllSaints",
        brand: "AllSaints",
        title: cleanupTitle(firstFromSources(ctx, "title") as string | null, "AllSaints"),
        color: (firstFromSources(ctx, "color") as string | null) ?? colorFromText(sourceText(ctx)),
      }),
  },
  {
    id: "macys",
    domains: ["macys.com"],
    canHandle: (url) => hostMatches(url.hostname, ["macys.com"]),
    extract: (ctx) => {
      const productId = ctx.url.pathname.match(/ID=(\d+)/i)?.[1] ?? ctx.url.searchParams.get("ID");
      return adapterResult(ctx, "macys", {
        retailer: "Macy's",
        title: cleanupTitle(firstFromSources(ctx, "title") as string | null, "Macy's"),
        brand: (firstFromSources(ctx, "brand") as string | null) ?? cleanText(sourceText(ctx).match(/\bbrand["':\s]+([A-Z][A-Za-z0-9 &'.-]{1,50})/i)?.[1], 80),
        productId: productId ?? (firstFromSources(ctx, "productId") as string | null),
        color: (firstFromSources(ctx, "color") as string | null) ?? colorFromText(sourceText(ctx)),
      });
    },
  },
  {
    id: "jdsports",
    domains: ["jdsports.com", "jdsports.co.uk"],
    canHandle: (url) => hostMatches(url.hostname, ["jdsports.com", "jdsports.co.uk"]),
    extract: (ctx) =>
      adapterResult(ctx, "jdsports", {
        retailer: "JD Sports",
        title: cleanupTitle(firstFromSources(ctx, "title") as string | null, "JD Sports"),
        brand: firstFromSources(ctx, "brand") as string | null,
        color: (firstFromSources(ctx, "color") as string | null) ?? colorFromText(sourceText(ctx)),
      }),
  },
  {
    id: "footlocker",
    domains: ["footlocker.com", "footlocker.ca", "footlocker.eu"],
    canHandle: (url) => hostMatches(url.hostname, ["footlocker.com", "footlocker.ca", "footlocker.eu"]),
    extract: (ctx) =>
      adapterResult(ctx, "footlocker", {
        retailer: "Foot Locker",
        title: cleanupTitle(firstFromSources(ctx, "title") as string | null, "Foot Locker"),
        brand: firstFromSources(ctx, "brand") as string | null,
        styleId: (firstFromSources(ctx, "styleId") as string | null) ?? cleanText(sourceText(ctx).match(/\bstyle(?:\s*id)?["':\s-]+([A-Z0-9-]{4,})/i)?.[1], 80),
        color: cleanText(ctx.html.match(/>\s*Color\s+([^<>]{1,120}?)\s+is selected\s*</i)?.[1], 120) ??
          (firstFromSources(ctx, "color") as string | null),
      }),
  },
  {
    id: "stockx",
    domains: ["stockx.com"],
    canHandle: (url) => hostMatches(url.hostname, ["stockx.com"]),
    extract: (ctx) => {
      const text = sourceText(ctx);
      return adapterResult(ctx, "stockx", {
        retailer: "StockX",
        title: cleanupTitle(firstFromSources(ctx, "title") as string | null, "StockX"),
        brand: firstFromSources(ctx, "brand") as string | null,
        color: (firstFromSources(ctx, "color") as string | null) ?? cleanText(text.match(/\bcolorway\s*[:/-]\s*([^|,\n]{2,50})/i)?.[1], 80),
        styleId: (firstFromSources(ctx, "styleId") as string | null) ?? cleanText(text.match(/\bstyle\s*[:/-]\s*([A-Z0-9-]{4,})/i)?.[1], 80),
        price: null,
        priceAmount: null,
        priceUnavailable: true,
        marketPriceUnavailable: true,
      });
    },
  },
  {
    id: "amazon",
    domains: AMAZON_DOMAINS,
    canHandle: (url) => hostMatches(url.hostname, AMAZON_DOMAINS),
    extract: (ctx) =>
      adapterResult(ctx, "amazon", {
        retailer: "Amazon",
        brand: firstFromSources(ctx, "brand") as string | null,
        sku: ctx.normalized.amazonAsin ?? (firstFromSources(ctx, "sku") as string | null),
        productId: ctx.normalized.amazonAsin ?? (firstFromSources(ctx, "productId") as string | null),
        canonicalUrl: ctx.normalized.amazonAsin ? ctx.normalized.normalizedUrl : ctx.url.toString(),
        priceUnavailable: !ctx.structured.priceAmount,
      }),
  },
];

function isPromiseLike(value: unknown): value is Promise<Partial<ProductExtractionResult>> {
  return !!value && typeof value === "object" && typeof (value as { then?: unknown }).then === "function";
}

function htmlExtractionWarnings(html: string) {
  const warnings: string[] = [];
  const text = cleanText(html.replace(/<script[\s\S]*?<\/script>/gi, " "), 2_000)?.toLowerCase() ?? "";
  if (!text) warnings.push("empty_html");
  else if (text.length < 80) warnings.push("near_empty_html");
  if (/\b(?:access denied|captcha|robot check|bot protection|request blocked|forbidden|verify you are human)\b/i.test(text)) {
    warnings.push("blocked_or_bot_check_page");
  }
  return warnings;
}

function withExtractionWarnings(result: ProductExtractionResult, warnings: string[]) {
  if (!warnings.length) return result;
  return {
    ...result,
    debug: {
      sources: result.debug?.sources ?? [],
      warnings: Array.from(new Set([...(result.debug?.warnings ?? []), ...warnings])),
      imageCandidateCount: result.debug?.imageCandidateCount,
    },
  };
}

function finalizeGenericProductResult(
  merged: ProductExtractionResult,
  normalized: NormalizedProductUrl,
  html: string,
): ProductExtractionResult {
  const result = withExtractionWarnings({
    ...merged,
    retailer: merged.retailer ?? normalized.retailer,
    sourceDomain: normalized.sourceDomain,
    canonicalUrl: merged.canonicalUrl ?? normalized.normalizedUrl,
    sku: merged.sku ?? normalized.amazonAsin,
    productId: merged.productId ?? normalized.amazonAsin,
  }, htmlExtractionWarnings(html));
  return {
    ...result,
    diagnostics: buildProductExtractionDiagnostics(result, normalized),
  };
}

function storefrontCurrencyFromHtml(html: string) {
  const explicit = cleanText(
    metaContent(html, "product:price:currency") ??
    metaContent(html, "og:price:currency"),
    12,
  )?.toUpperCase();
  if (explicit && /^[A-Z]{3}$/.test(explicit)) return explicit;
  const shopifyCurrency = [
    html.match(/Shopify\.currency\s*=\s*\{[^}]*["']active["']\s*:\s*["']([A-Z]{3})["']/i)?.[1],
    html.match(/\bdata-currency=["']([A-Z]{3})["']/i)?.[1],
    html.match(/["']paymentSettings["']\s*:\s*\{[^}]*["']currencyCode["']\s*:\s*["']([A-Z]{3})["']/i)?.[1],
  ].find((value) => !!value)?.toUpperCase();
  if (shopifyCurrency) return shopifyCurrency;
  const locale = cleanText(metaContent(html, "og:locale"), 20)?.replace("-", "_").toUpperCase();
  const country = locale?.split("_")[1] ?? null;
  const currencies: Record<string, string> = {
    US: "USD",
    GB: "GBP",
    CA: "CAD",
    AU: "AUD",
    NZ: "NZD",
    JP: "JPY",
    IN: "INR",
  };
  if (country && currencies[country]) return currencies[country];
  if (country && ["AT", "BE", "DE", "ES", "FI", "FR", "IE", "IT", "NL", "PT"].includes(country)) {
    return "EUR";
  }
  return null;
}

export function extractGenericProductDataSync(rawUrl: string | URL, html: string): ProductExtractionResult {
  const normalized = normalizeProductUrl(rawUrl);
  const structured = extractStructuredData(html, normalized.url);
  const embedded = extractEmbeddedAppState(html, normalized.url);
  const openGraph = extractOpenGraph(html, normalized.url);
  const ctx: ProductExtractionContext = {
    url: normalized.url,
    normalized,
    html,
    structured,
    embedded,
    openGraph,
  };
  const adapter = retailerAdapters.find((entry) => entry.canHandle(normalized.url));
  const adapterExtracted = adapter ? adapter.extract(ctx) : null;
  const adapterPartial = isPromiseLike(adapterExtracted) ? null : adapterExtracted;
  const merged = mergeExtractionResults([adapterPartial, structured, embedded, openGraph], normalized.url, {
    preferredCurrency: storefrontCurrencyFromHtml(html),
  });
  return finalizeGenericProductResult(merged, normalized, html);
}

export async function extractGenericProductData(rawUrl: string | URL, html: string): Promise<ProductExtractionResult> {
  const normalized = normalizeProductUrl(rawUrl);
  const structured = extractStructuredData(html, normalized.url);
  const embedded = extractEmbeddedAppState(html, normalized.url);
  const openGraph = extractOpenGraph(html, normalized.url);
  const ctx: ProductExtractionContext = {
    url: normalized.url,
    normalized,
    html,
    structured,
    embedded,
    openGraph,
  };
  const adapter = retailerAdapters.find((entry) => entry.canHandle(normalized.url));
  const adapterPartial = adapter ? await adapter.extract(ctx) : null;
  const merged = mergeExtractionResults([adapterPartial, structured, embedded, openGraph], normalized.url, {
    preferredCurrency: storefrontCurrencyFromHtml(html),
  });
  return finalizeGenericProductResult(merged, normalized, html);
}
