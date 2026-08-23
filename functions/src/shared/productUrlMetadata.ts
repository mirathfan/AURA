import {
  extractProductFromUrl,
  type ProductExtraction,
} from "./productLinkExtractor";
import {
  type ProductExtractionDiagnostics,
  type ProductFieldConfidence,
} from "./productExtractionPipeline";
import { type ProductLinkWarningCode } from "./productLinkRelease";

/**
 * Stable backend-owned metadata contract consumed by product-link previews.
 * The extractor may evolve internally, but this compatibility projection stays
 * available to released clients while Extraction V2 remains feature-flagged.
 */
export type ProductUrlMetadata = {
  sourceUrl: string;
  canonicalUrl?: string | null;
  title: string | null;
  imageUrl: string | null;
  imageUrls?: string[];
  description: string | null;
  brand?: string | null;
  category?: string | null;
  subCategory?: string | null;
  color?: string | null;
  price?: string | null;
  currency?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  priceDisplay?: string | null;
  salePrice?: number | null;
  originalPrice?: number | null;
  material?: string | null;
  materials?: string[];
  fit?: string | null;
  sleeveLength?: string | null;
  collar?: string | null;
  length?: string | null;
  pattern?: string | null;
  displayColor?: string | null;
  displayColors?: string[] | null;
  sizeOptions?: string[];
  availableSizes?: string[];
  careInstructions?: string[];
  productDescription?: string | null;
  graphicText?: string | null;
  motif?: string | null;
  collaborationName?: string | null;
  sku?: string | null;
  styleId?: string | null;
  productId?: string | null;
  availability?: string | null;
  selectedSize?: string | null;
  sizes?: string[];
  extractionSource?: string | null;
  adapterName?: string | null;
  priceUnavailable?: boolean;
  marketPriceUnavailable?: boolean;
  titleConfidence?: ProductFieldConfidence;
  brandConfidence?: ProductFieldConfidence;
  priceConfidence?: ProductFieldConfidence;
  imageConfidence?: ProductFieldConfidence;
  categoryConfidence?: ProductFieldConfidence;
  subcategoryConfidence?: ProductFieldConfidence;
  colorConfidence?: ProductFieldConfidence;
  extractionDiagnostics?: ProductExtractionDiagnostics;
  warningCodes?: ProductLinkWarningCode[];
  selectedImageReason?: string | null;
  confidence?: number | null;
  status?: "ready" | "needs_review";
};

export function productUrlMetadataFromProductExtraction(
  extraction: ProductExtraction,
): ProductUrlMetadata {
  const metadata = extraction.metadata;
  return {
    sourceUrl: metadata.sourceUrl,
    canonicalUrl: metadata.canonicalUrl ?? metadata.sourceUrl,
    title: metadata.title ?? null,
    imageUrl: extraction.imageUrls[0] ?? null,
    imageUrls: extraction.imageUrls,
    description: metadata.description ?? metadata.productDescription ?? null,
    brand: metadata.brand ?? null,
    category: metadata.category ?? metadata.categoryHints?.[0] ?? null,
    subCategory: metadata.subCategory ?? metadata.categoryHints?.[1] ?? null,
    color: metadata.color ?? null,
    price: metadata.price ?? null,
    currency: metadata.currency ?? null,
    priceAmount: metadata.priceAmount ?? null,
    priceCurrency: metadata.priceCurrency ?? null,
    priceDisplay: metadata.priceDisplay ?? null,
    salePrice: metadata.salePrice ?? null,
    originalPrice: metadata.originalPrice ?? null,
    material: metadata.material ?? null,
    materials: metadata.materials ?? [],
    fit: metadata.fit ?? null,
    sleeveLength: metadata.sleeveLength ?? null,
    collar: metadata.collar ?? null,
    length: metadata.length ?? null,
    pattern: metadata.pattern ?? null,
    displayColor: metadata.displayColor ?? metadata.color ?? null,
    displayColors: metadata.displayColors ?? [],
    sizeOptions: metadata.sizeOptions ?? metadata.sizeHints ?? [],
    availableSizes: metadata.availableSizes ?? metadata.sizeOptions ?? [],
    careInstructions: metadata.careInstructions ?? [],
    productDescription: metadata.productDescription ?? metadata.description ?? null,
    graphicText: metadata.graphicText ?? null,
    motif: metadata.motif ?? null,
    collaborationName: metadata.collaborationName ?? null,
    sku: metadata.sku ?? null,
    styleId: metadata.styleId ?? null,
    productId: metadata.productId ?? null,
    availability: metadata.availability ?? null,
    selectedSize: metadata.selectedSize ?? null,
    sizes: metadata.sizes ?? metadata.sizeOptions ?? [],
    extractionSource: metadata.extractionSource ?? null,
    adapterName: metadata.adapterName ?? null,
    priceUnavailable: metadata.priceUnavailable ?? undefined,
    marketPriceUnavailable: metadata.marketPriceUnavailable ?? undefined,
    titleConfidence: metadata.titleConfidence,
    brandConfidence: metadata.brandConfidence,
    priceConfidence: metadata.priceConfidence,
    imageConfidence: metadata.imageConfidence,
    categoryConfidence: metadata.categoryConfidence,
    subcategoryConfidence: metadata.subcategoryConfidence,
    colorConfidence: metadata.colorConfidence,
    extractionDiagnostics: metadata.extractionDiagnostics,
    warningCodes: metadata.warningCodes ?? metadata.extractionDiagnostics?.warningCodes,
    selectedImageReason:
      extraction.selectedImageReason ?? metadata.selectedImageReason ?? null,
    confidence: extraction.confidence ?? null,
    status: extraction.status ?? "ready",
  };
}

/** One backend extraction authority for preview, import, and AURA callers. */
export async function extractProductUrlMetadata(rawUrl: string): Promise<ProductUrlMetadata> {
  return productUrlMetadataFromProductExtraction(await extractProductFromUrl(rawUrl));
}
