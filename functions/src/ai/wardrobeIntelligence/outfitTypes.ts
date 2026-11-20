import type { WardrobeRetrievalCategoryBucket, WardrobeRetrievalFormality } from "./retrievalTypes";
import type { FootwearKind } from "./footwearSwap";
import type { OutfitTargetDay } from "../../../../shared/outfitTargetDay";
import type {
  OutfitLaundryState,
  OutfitUserPreferences,
  OutfitWeatherContext,
} from "./outfitSignals";

export type OutfitRole =
  | "top"
  | "bottom"
  | "footwear"
  | "outerwear"
  | "accessory"
  | "one_piece";

export type CanonicalOutfitRole = OutfitRole | "unknown";

export const OUTFIT_ROLES: OutfitRole[] = [
  "top",
  "bottom",
  "footwear",
  "outerwear",
  "accessory",
  "one_piece",
];

export type OutfitGenerationInput = {
  query: string;
  count?: number;
  occasion?: string;
  weather?: string;
  // The user's own words for this turn, without the chat context the agent
  // appends to `query`. Used to tell what the user named or which day they mean.
  userText?: string;
  weatherContext?: OutfitWeatherContext;
  localDate?: string;
  formality?: WardrobeRetrievalFormality;
  preferredColors?: string[];
  requiredColors?: string[];
  requiredCategories?: string[];
  selectedItemIds?: string[];
  requiredItemIds?: string[];
  avoidItemIds?: string[];
  avoidTerms?: string[];
  includeDiagnostics?: boolean;
  useStyleMemory?: boolean;
};

export type NormalizedOutfitGenerationInput = {
  query: string;
  count: number;
  occasion?: string;
  weather?: string;
  weatherContext?: OutfitWeatherContext;
  localDate?: string;
  userText: string;
  replacementFootwear?: FootwearKind;
  targetDay: OutfitTargetDay;
  weatherIgnoredReason?: "other_day" | "wrong_date" | "stale";
  formality: WardrobeRetrievalFormality;
  preferredColors: string[];
  requiredColors: string[];
  requiredCategories: OutfitRole[];
  requiredItemIds: string[];
  avoidItemIds: string[];
  avoidTerms: string[];
  includeDiagnostics: boolean;
  useStyleMemory: boolean;
};

export type OutfitRetrievalIntent = {
  occasion?: string;
  formality: WardrobeRetrievalFormality;
  weather?: string;
  styleHints: string[];
  colorHints: string[];
  categorySpecificConstraints: Partial<Record<OutfitRole, string[]>>;
};

export type OutfitRetrievalPlan = {
  intent: OutfitRetrievalIntent;
  categoryQueries: {
    top: string;
    bottom: string;
    footwear: string;
    outerwear: string;
    accessory: string;
    one_piece?: string;
  };
};

export type OutfitCandidate = {
  itemId: string;
  name: string;
  category: WardrobeRetrievalCategoryBucket;
  role: OutfitRole;
  canonicalRole: OutfitRole;
  allowedRole: OutfitRole;
  sourceRole?: OutfitRole;
  sourceCategory?: string | null;
  sourceAiMetadataCategory?: string | null;
  subcategory?: string;
  brand?: string;
  colors: string[];
  score: number | null;
  vectorScore: number | null;
  finalScore: number | null;
  reason: string;
  imageUrl: string | null;
  aiMetadata: Record<string, unknown>;
  embeddingTextPreview: string | null;
  status: string | null;
  laundryState?: OutfitLaundryState;
  daysSinceWorn?: number | null;
  wearCountSinceWash?: number | null;
  pattern?: string;
};

export type OutfitLaundryNotices = {
  // Selected explicitly (kept, because the selection wins) but marked in the laundry.
  selectedInLaundry: string[];
  // Named in the request and left out because they are in the laundry.
  namedInLaundry: string[];
};

export type OutfitCandidateBuckets = Record<OutfitRole, OutfitCandidate[]>;

export type OutfitGenerationContext = {
  retrievalPlan: OutfitRetrievalPlan;
  candidates: OutfitCandidateBuckets;
  styleMemory?: OutfitStyleMemoryContext | null;
  userPreferences?: OutfitUserPreferences | null;
  diagnostics: {
    laundryExcludedCount?: number;
    rotationExcludedCount?: number;
    rotationMode?: "soft" | "hard";
    // Items the user asked for that are in the laundry. Names are the user's
    // own item names; they go back to that user only.
    laundryNotices?: OutfitLaundryNotices;
    weatherIgnoredReason?: "other_day" | "wrong_date" | "stale";
    candidateLimitPerCategory: number;
    rawLimitPerCategory: number;
    missingRequiredRoles: OutfitRole[];
    missingRequiredItemIds?: string[];
    unavailableRequiredItemIds?: string[];
    incompatibleRequiredItemIds?: string[];
    candidateCounts: Record<OutfitRole, number>;
    categoryQueries: OutfitRetrievalPlan["categoryQueries"];
  };
};

export type OutfitStyleMemorySignal = {
  value: string;
  weight: number;
};

export type OutfitStyleMemoryContext = {
  profileSummary: string;
  profileSignals: {
    preferredColors: OutfitStyleMemorySignal[];
    avoidedColors: OutfitStyleMemorySignal[];
    preferredStyleTags: OutfitStyleMemorySignal[];
    avoidedStyleTags: OutfitStyleMemorySignal[];
    preferredFits: OutfitStyleMemorySignal[];
    avoidedFits: OutfitStyleMemorySignal[];
    preferredBrands: OutfitStyleMemorySignal[];
    avoidedBrands: OutfitStyleMemorySignal[];
    preferredCategories: OutfitStyleMemorySignal[];
    avoidedCategories: OutfitStyleMemorySignal[];
    preferredMaterials: OutfitStyleMemorySignal[];
    avoidedMaterials: OutfitStyleMemorySignal[];
    itemAffinities: OutfitStyleMemorySignal[];
    avoidedItemIds: OutfitStyleMemorySignal[];
    avoidedOutfitFingerprints: OutfitStyleMemorySignal[];
    formalityBiasByOccasion?: Record<string, number>;
  };
  positiveMemories: {
    id: string;
    text: string;
    strength: number;
    confidence: number;
    type: string;
    entities?: Record<string, unknown>;
    occasionCompatibility?: number;
    finalMemoryScore?: number;
  }[];
  negativeMemories: {
    id: string;
    text: string;
    strength: number;
    confidence: number;
    type: string;
    entities?: Record<string, unknown>;
    occasionCompatibility?: number;
    finalMemoryScore?: number;
  }[];
};

export type GeneratedOutfitItem = {
  itemId: string;
  role: OutfitRole;
  reason: string;
};

export type GeneratedOutfit = {
  title: string;
  vibe: string;
  occasion: string;
  formality: Exclude<WardrobeRetrievalFormality, "any">;
  items: GeneratedOutfitItem[];
  explanation: string;
  stylingTips: string[];
  missingItems: string[];
  confidence: number;
};

export type GeneratedOutfitPayload = {
  outfits: GeneratedOutfit[];
  stylistMessage?: string;
};

export type OutfitScoreBreakdown = {
  categoryCompleteness: number;
  occasionFit: number;
  colorCoherence: number;
  colorCoherenceReasons: string[];
  formalityFit: number;
  targetFormality: number;
  targetFormalityRange: [number, number];
  formalityFitReason: string;
  formalityBiasApplied: number;
  formalityBiasReason: string;
  itemEffectiveFormalities: {
    itemId: string;
    name: string;
    role: OutfitRole;
    rawFormality: number | null;
    effectiveFormality: number;
  }[];
  retrievalStrength: number;
  stylePreferenceFit: number;
  styleMemoryReasons: string[];
  memoryBoosts: string[];
  memoryPenalties: string[];
  diversityScore: number;
  diversityPenalties: string[];
  penalties: string[];
  total: number;
};

export type ValidatedOutfitItem = GeneratedOutfitItem & {
  name: string;
  category: WardrobeRetrievalCategoryBucket;
  canonicalRole?: OutfitRole;
  allowedRole?: OutfitRole;
  sourceRole?: OutfitRole;
  sourceCategory?: string | null;
  sourceAiMetadataCategory?: string | null;
  subcategory?: string;
  brand?: string;
  colors: string[];
  imageUrl: string | null;
  aiMetadata: Record<string, unknown>;
  effectiveFormality?: number;
};

export type ValidatedOutfit = {
  outfitId: string;
  title: string;
  vibe: string;
  occasion: string;
  formality: Exclude<WardrobeRetrievalFormality, "any">;
  items: ValidatedOutfitItem[];
  explanation: string;
  stylingTips: string[];
  missingItems: string[];
  confidence: number;
  scoreBreakdown: OutfitScoreBreakdown;
};

export type OutfitValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedOutfits: GeneratedOutfit[];
  validationWarnings: OutfitValidationWarning[];
};

export type OutfitValidationWarning = {
  outfitIndex: number;
  issue: string;
  action: "repaired" | "dropped" | "auto_corrected_role" | "warning";
};

export type OutfitRecommendationResponse = {
  query: string;
  retrievalPlan: OutfitRetrievalPlan;
  outfits: ValidatedOutfit[];
  diagnostics?: Record<string, unknown>;
};
