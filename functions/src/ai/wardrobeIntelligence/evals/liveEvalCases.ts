import type { OutfitRole } from "../outfitTypes";
import type { OutfitUserPreferences, OutfitWeatherContext } from "../outfitSignals";

// Synthetic closet and scenarios for the live quality eval. Nothing here comes
// from a real user: the live eval may only ever send this file's data to a
// model provider.

export type LiveEvalItem = {
  id: string;
  name: string;
  role: OutfitRole;
  subcategory: string;
  colors: string[];
  styleTags: string[];
  occasionTags: string[];
  formality: number;
  fit: string;
  material: string;
  pattern: string;
  warmth: number;
  seasonTags: string[];
  weatherTags: string[];
};

export type LiveEvalCase = {
  id: string;
  query: string;
  notes: string;
  weatherContext?: OutfitWeatherContext;
  localDate?: string;
  userPreferences?: OutfitUserPreferences;
  laundryItemIds?: string[];
  needsWashItemIds?: string[];
  // itemId -> days since last worn. Items not listed were worn 20 days ago.
  wornDaysAgo?: Record<string, number>;
  avoidColors?: string[];
  // Held-out cases are never used to tune the prompt or the rules.
  heldOut?: boolean;
  // Restrict the closet to these items (small-closet scenarios).
  closetItemIds?: string[];
  // Pieces the user selected to keep, and pieces they asked to replace.
  requiredItemIds?: string[];
  avoidItemIds?: string[];
  // The request is for the office: casual-only pieces are wrong.
  officeRequest?: boolean;
  // Laundry items the reply must explain, because the user asked for them.
  expectLaundryNoticeItemIds?: string[];
  // Weather the outfit should actually be judged against when the request
  // states something different from the live reading.
  judgedWeather?: { band: "freezing" | "cold" | "cool" | "mild" | "warm" | "hot"; wet: boolean; text: string };
};

function item(
  id: string,
  name: string,
  role: OutfitRole,
  subcategory: string,
  colors: string[],
  details: {
    style: string[];
    occasions: string[];
    formality: number;
    fit: string;
    material: string;
    pattern?: string;
    warmth: number;
    seasons?: string[];
    weather?: string[];
  },
): LiveEvalItem {
  return {
    id,
    name,
    role,
    subcategory,
    colors,
    styleTags: details.style,
    occasionTags: details.occasions,
    formality: details.formality,
    fit: details.fit,
    material: details.material,
    pattern: details.pattern ?? "solid",
    warmth: details.warmth,
    seasonTags: details.seasons ?? [],
    weatherTags: details.weather ?? [],
  };
}

export const LIVE_EVAL_CLOSET: LiveEvalItem[] = [
  item("live-white-tee", "White Heavyweight Tee", "top", "t-shirt", ["white"], {
    style: ["casual", "minimal", "streetwear"], occasions: ["casual", "weekend"], formality: 1,
    fit: "relaxed", material: "cotton jersey", warmth: 1, seasons: ["spring", "summer"], weather: ["warm", "hot"],
  }),
  item("live-black-tee", "Black Boxy Tee", "top", "t-shirt", ["black"], {
    style: ["casual", "streetwear", "minimal"], occasions: ["casual", "weekend", "night out"], formality: 1,
    fit: "oversized", material: "cotton jersey", warmth: 1, seasons: ["spring", "summer"], weather: ["warm", "hot"],
  }),
  item("live-white-oxford", "White Oxford Shirt", "top", "oxford shirt", ["white"], {
    style: ["classic", "smart casual", "clean"], occasions: ["office", "dinner", "date"], formality: 3,
    fit: "regular", material: "cotton oxford", warmth: 2, seasons: ["spring", "fall"], weather: ["mild"],
  }),
  item("live-blue-linen-shirt", "Light Blue Linen Shirt", "top", "linen shirt", ["light blue"], {
    style: ["relaxed", "resort", "breathable"], occasions: ["vacation", "date", "casual"], formality: 2,
    fit: "relaxed", material: "linen", warmth: 1, seasons: ["summer"], weather: ["hot", "warm"],
  }),
  item("live-charcoal-knit", "Charcoal Merino Crewneck", "top", "sweater", ["charcoal", "gray"], {
    style: ["refined", "minimal", "smart casual"], occasions: ["dinner", "office", "date"], formality: 3,
    fit: "regular", material: "merino wool", warmth: 4, seasons: ["fall", "winter"], weather: ["cold", "cool"],
  }),
  item("live-cream-hoodie", "Cream Heavy Hoodie", "top", "hoodie", ["cream"], {
    style: ["streetwear", "relaxed", "casual"], occasions: ["casual", "weekend"], formality: 1,
    fit: "oversized", material: "cotton fleece", warmth: 4, seasons: ["fall", "winter"], weather: ["cold", "cool"],
  }),
  item("live-orange-polo", "Bright Orange Polo", "top", "polo", ["orange"], {
    style: ["sporty", "casual", "bold"], occasions: ["casual", "weekend"], formality: 2,
    fit: "regular", material: "cotton pique", warmth: 1, seasons: ["summer"], weather: ["warm", "hot"],
  }),
  item("live-black-turtleneck", "Black Fine-Knit Turtleneck", "top", "turtleneck", ["black"], {
    style: ["sleek", "minimal", "elevated"], occasions: ["dinner", "date", "night out"], formality: 3,
    fit: "slim", material: "merino wool", warmth: 3, seasons: ["fall", "winter"], weather: ["cold", "cool"],
  }),
  item("live-dark-denim", "Dark Indigo Straight Jeans", "bottom", "jeans", ["indigo", "navy"], {
    style: ["casual", "classic", "smart casual"], occasions: ["casual", "dinner", "date"], formality: 2,
    fit: "regular", material: "denim", warmth: 3, seasons: ["fall", "winter", "spring"], weather: ["cool", "mild"],
  }),
  item("live-black-trousers", "Black Pleated Trousers", "bottom", "trousers", ["black"], {
    style: ["tailored", "smart casual", "minimal"], occasions: ["office", "dinner", "date"], formality: 3,
    fit: "relaxed", material: "wool blend", warmth: 3, seasons: ["fall", "winter", "spring"], weather: ["cool", "mild"],
  }),
  item("live-stone-linen-trousers", "Stone Linen Trousers", "bottom", "linen trousers", ["stone", "beige"], {
    style: ["relaxed", "resort", "breathable"], occasions: ["vacation", "casual", "date"], formality: 2,
    fit: "relaxed", material: "linen", warmth: 1, seasons: ["summer"], weather: ["hot", "warm"],
  }),
  item("live-olive-shorts", "Olive Cotton Shorts", "bottom", "shorts", ["olive", "green"], {
    style: ["casual", "relaxed"], occasions: ["casual", "weekend", "vacation"], formality: 1,
    fit: "regular", material: "cotton twill", warmth: 1, seasons: ["summer"], weather: ["hot"],
  }),
  item("live-black-cargos", "Black Wide Cargos", "bottom", "cargo pants", ["black"], {
    style: ["streetwear", "utility", "relaxed"], occasions: ["casual", "weekend", "night out"], formality: 1,
    fit: "oversized", material: "cotton ripstop", warmth: 2, seasons: ["spring", "fall"], weather: ["mild", "cool"],
  }),
  item("live-white-sneakers", "White Leather Sneakers", "footwear", "sneakers", ["white"], {
    style: ["clean", "minimal", "casual"], occasions: ["casual", "office", "date"], formality: 2,
    fit: "regular", material: "leather", warmth: 2, seasons: ["spring", "summer", "fall"], weather: ["mild", "warm"],
  }),
  item("live-brown-boots", "Brown Leather Chelsea Boots", "footwear", "boots", ["brown"], {
    style: ["refined", "classic", "smart casual"], occasions: ["dinner", "date", "office"], formality: 3,
    fit: "regular", material: "leather", warmth: 4, seasons: ["fall", "winter"], weather: ["cold", "cool", "rain"],
  }),
  item("live-tan-suede-loafers", "Tan Suede Loafers", "footwear", "loafers", ["tan"], {
    style: ["smart casual", "refined"], occasions: ["office", "dinner", "date"], formality: 3,
    fit: "regular", material: "suede", warmth: 2, seasons: ["spring", "summer"], weather: ["mild", "warm"],
  }),
  item("live-leather-sandals", "Brown Leather Sandals", "footwear", "sandals", ["brown"], {
    style: ["relaxed", "resort"], occasions: ["vacation", "casual"], formality: 1,
    fit: "regular", material: "leather", warmth: 1, seasons: ["summer"], weather: ["hot"],
  }),
  item("live-black-puffer", "Black Down Puffer", "outerwear", "puffer jacket", ["black"], {
    style: ["streetwear", "practical", "casual"], occasions: ["casual", "weekend"], formality: 1,
    fit: "oversized", material: "nylon down", warmth: 5, seasons: ["winter"], weather: ["cold", "freezing"],
  }),
  item("live-camel-coat", "Camel Wool Overcoat", "outerwear", "overcoat", ["camel", "tan"], {
    style: ["refined", "classic", "elevated"], occasions: ["dinner", "office", "date"], formality: 4,
    fit: "regular", material: "wool", warmth: 5, seasons: ["winter", "fall"], weather: ["cold", "freezing"],
  }),
  item("live-brown-suede-jacket", "Brown Suede Trucker Jacket", "outerwear", "jacket", ["brown"], {
    style: ["refined", "casual", "textured"], occasions: ["dinner", "date", "casual"], formality: 3,
    fit: "regular", material: "suede", warmth: 3, seasons: ["fall", "spring"], weather: ["cool", "mild"],
  }),
  item("live-navy-rain-shell", "Navy Waterproof Shell", "outerwear", "rain jacket", ["navy"], {
    style: ["practical", "minimal", "casual"], occasions: ["casual", "commute"], formality: 1,
    fit: "regular", material: "waterproof nylon", warmth: 2, seasons: ["spring", "fall"], weather: ["rain", "wet", "cool"],
  }),
  item("live-olive-overshirt", "Olive Cotton Overshirt", "outerwear", "overshirt", ["olive", "green"], {
    style: ["casual", "utility", "layered"], occasions: ["casual", "weekend", "date"], formality: 2,
    fit: "relaxed", material: "cotton twill", warmth: 2, seasons: ["spring", "fall"], weather: ["mild", "cool"],
  }),
  item("live-steel-watch", "Steel Dive Watch", "accessory", "watch", ["silver"], {
    style: ["classic", "clean"], occasions: ["office", "dinner", "casual"], formality: 3,
    fit: "regular", material: "stainless steel", warmth: 1,
  }),
  item("live-gray-beanie", "Gray Wool Beanie", "accessory", "beanie", ["gray"], {
    style: ["casual", "streetwear"], occasions: ["casual", "weekend"], formality: 1,
    fit: "regular", material: "wool", warmth: 3, seasons: ["winter"], weather: ["cold", "freezing"],
  }),
];

const RELAXED_STREETWEAR: OutfitUserPreferences = {
  wardrobeMode: "masculine",
  styleAesthetics: ["Streetwear", "Casual", "Smart Casual"],
  favoriteColors: ["black", "cream"],
  preferredFit: "relaxed",
};

export const LIVE_EVAL_CASES: LiveEvalCase[] = [
  {
    id: "cold-dinner-unstated-weather",
    query: "dinner tonight, nothing too formal",
    notes: "Freezing evening. The user did not mention weather, so only live context can supply it.",
    weatherContext: { tempF: 28, condition: "Clear" },
    localDate: "2026-01-16",
    userPreferences: RELAXED_STREETWEAR,
  },
  {
    id: "cold-casual-saturday",
    query: "what should I wear today",
    notes: "Cold Saturday with no plans stated. A weekend look with real warmth is expected.",
    weatherContext: { highF: 36, lowF: 24, condition: "Cloudy" },
    localDate: "2026-01-17",
    userPreferences: RELAXED_STREETWEAR,
  },
  {
    id: "hot-day-errands",
    query: "something easy for running errands",
    notes: "Hot afternoon. Heavy knits, boots and coats would be wrong.",
    weatherContext: { tempF: 93, condition: "Sunny" },
    localDate: "2026-07-18",
  },
  {
    id: "rainy-commute-office",
    query: "outfit for the office today",
    notes: "Cool and raining. Suede and sandals should be avoided; a rain layer is sensible.",
    weatherContext: { tempF: 52, condition: "Rain" },
    localDate: "2026-10-06",
  },
  {
    id: "laundry-favourites-unavailable",
    query: "smart casual look for a date",
    notes: "The most obvious date pieces are in the laundry and must not be used.",
    weatherContext: { tempF: 58, condition: "Clear" },
    localDate: "2026-10-10",
    laundryItemIds: ["live-charcoal-knit", "live-black-trousers", "live-brown-boots"],
  },
  {
    id: "laundry-plus-cold",
    query: "give me a fit for tonight",
    notes: "Cold night and the warmest coat is in the laundry. The outfit still needs warmth.",
    weatherContext: { tempF: 34, condition: "Clear" },
    localDate: "2026-12-05",
    laundryItemIds: ["live-camel-coat", "live-black-turtleneck"],
    userPreferences: RELAXED_STREETWEAR,
  },
  {
    id: "avoided-colour-orange",
    query: "casual weekend outfit",
    notes: "The user told us they avoid orange. Warm weather makes the orange polo tempting.",
    weatherContext: { tempF: 80, condition: "Sunny" },
    localDate: "2026-06-20",
    userPreferences: { ...RELAXED_STREETWEAR, avoidedColors: ["orange"] },
    avoidColors: ["orange"],
  },
  {
    id: "recently-worn-rotation",
    query: "casual outfit for today",
    notes: "The default casual pieces were worn yesterday. Fresh alternatives exist.",
    weatherContext: { tempF: 64, condition: "Partly cloudy" },
    localDate: "2026-04-22",
    wornDaysAgo: { "live-white-tee": 1, "live-dark-denim": 1, "live-white-sneakers": 0 },
    userPreferences: { ...RELAXED_STREETWEAR, prioritizeUnderused: true },
  },
  {
    id: "needs-wash-prefers-clean",
    query: "office outfit, clean and simple",
    notes: "The oxford has been worn twice since washing. A clean equivalent option exists in the knit.",
    weatherContext: { tempF: 50, condition: "Cloudy" },
    localDate: "2026-11-03",
    needsWashItemIds: ["live-white-oxford"],
  },
  {
    id: "fit-preference-relaxed",
    query: "night out look",
    notes: "The user prefers relaxed fits. Judged on taste only: no relaxed top clearly suits a night out, so there is no hard check.",
    weatherContext: { tempF: 60, condition: "Clear" },
    localDate: "2026-09-19",
    userPreferences: RELAXED_STREETWEAR,
  },
  {
    id: "typed-weather-overrides-live",
    query: "pack me an outfit for a beach vacation, it will be hot there",
    notes: "It is freezing at home but the user stated a hot destination. The request must win.",
    weatherContext: { tempF: 25, condition: "Snow" },
    localDate: "2026-02-02",
    judgedWeather: { band: "hot", wet: false, text: "hot beach destination stated by the user" },
  },
  {
    id: "mild-day-no-pressure",
    query: "what should I wear today",
    notes: "Mild, dry day with nothing unusual. Control case: both arms should do well.",
    weatherContext: { tempF: 68, condition: "Clear" },
    localDate: "2026-05-12",
    userPreferences: RELAXED_STREETWEAR,
  },
];

// Held-out scenarios. They were written after the rules and prompt were
// settled and must not be used to tune either.
export const HELD_OUT_LIVE_EVAL_CASES: LiveEvalCase[] = [
  {
    id: "heldout-small-closet-cold",
    heldOut: true,
    query: "what should I wear today",
    notes: "Six-item closet on a freezing day. The only warm top and the boots were just worn; rotation must not remove them.",
    closetItemIds: [
      "live-white-tee", "live-charcoal-knit", "live-dark-denim",
      "live-white-sneakers", "live-brown-boots", "live-black-puffer",
    ],
    weatherContext: { tempF: 30, condition: "Clear" },
    localDate: "2026-01-12",
    wornDaysAgo: { "live-charcoal-knit": 1, "live-brown-boots": 0 },
    userPreferences: RELAXED_STREETWEAR,
  },
  {
    id: "heldout-small-closet-all-worn",
    heldOut: true,
    query: "casual outfit for today",
    notes: "Four-item closet and everything was worn yesterday. An outfit must still come back.",
    closetItemIds: ["live-white-tee", "live-black-tee", "live-dark-denim", "live-white-sneakers"],
    weatherContext: { tempF: 70, condition: "Clear" },
    localDate: "2026-05-04",
    wornDaysAgo: { "live-white-tee": 1, "live-black-tee": 1, "live-dark-denim": 1, "live-white-sneakers": 1 },
  },
  {
    id: "heldout-named-laundry-coat",
    heldOut: true,
    query: "dinner outfit with my camel wool overcoat",
    notes: "The user names a coat that is in the laundry. It must not be used, and the reply must say why.",
    weatherContext: { tempF: 36, condition: "Clear" },
    localDate: "2026-12-11",
    laundryItemIds: ["live-camel-coat"],
    expectLaundryNoticeItemIds: ["live-camel-coat"],
  },
  {
    id: "heldout-named-laundry-kind",
    heldOut: true,
    query: "something relaxed with jeans",
    notes: "The only jeans are in the laundry. They must not be used, and the reply must say so.",
    weatherContext: { tempF: 60, condition: "Cloudy" },
    localDate: "2026-10-02",
    laundryItemIds: ["live-dark-denim"],
    expectLaundryNoticeItemIds: ["live-dark-denim"],
  },
  {
    id: "heldout-outerwear-reuse",
    heldOut: true,
    query: "what should I wear today",
    notes: "Freezing, and both warm coats were worn yesterday and count as worn since washing. A warm coat is still the right answer.",
    weatherContext: { tempF: 24, condition: "Snow" },
    localDate: "2026-01-20",
    wornDaysAgo: { "live-black-puffer": 1, "live-camel-coat": 0 },
    needsWashItemIds: ["live-black-puffer", "live-camel-coat"],
  },
  {
    id: "heldout-changed-occasion-office",
    heldOut: true,
    query: "I was dressed for the weekend but now I need to go into the office instead",
    notes: "The occasion changed mid-conversation. Weekend-only pieces are wrong for the office.",
    weatherContext: { tempF: 58, condition: "Cloudy" },
    localDate: "2026-10-14",
    officeRequest: true,
    userPreferences: RELAXED_STREETWEAR,
  },
  {
    id: "heldout-missing-weather",
    heldOut: true,
    query: "dinner with friends tonight",
    notes: "An older app: no weather and no date are sent. The request must still work.",
  },
  {
    id: "heldout-tomorrow-forecast",
    heldOut: true,
    query: "what should I wear tomorrow",
    notes: "Mild today but freezing tomorrow. The outfit is for tomorrow, so the forecast applies.",
    weatherContext: { highF: 30, lowF: 18, condition: "Clear", forDate: "2026-02-10" },
    localDate: "2026-02-09",
    judgedWeather: { band: "freezing", wet: false, text: "freezing tomorrow, high 30°F / low 18°F; Clear" },
  },
  {
    id: "heldout-shoe-only-swap",
    heldOut: true,
    query: "keep this outfit but give me different shoes",
    notes: "A shoe-only swap. The tee and cargos must stay and the old sneakers must go.",
    weatherContext: { tempF: 66, condition: "Clear" },
    localDate: "2026-04-18",
    requiredItemIds: ["live-black-tee", "live-black-cargos"],
    avoidItemIds: ["live-white-sneakers"],
    userPreferences: RELAXED_STREETWEAR,
  },
];
