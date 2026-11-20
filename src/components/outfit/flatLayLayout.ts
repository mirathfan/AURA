export type FlatLayItem = {
  id: string;
  category: string;
  imageUrl: string | null;
};

export type SlotStyle = {
  top: string;
  left: string;
  width: string;
  height: string;
  zIndex: number;
};

export type FlatLayResult = {
  item: FlatLayItem;
  slot: string;
  style: SlotStyle;
};

type SlotDef = {
  top: number;
  left: number;
  width: number;
  height: number;
  zIndex: number;
};

// All percentage values relative to the FlatLayCanvas container dimensions
const SLOT_DEFS: Record<string, SlotDef> = {
  outerwear: { top: 2,  left: 0,  width: 38, height: 45, zIndex: 3 },
  top:       { top: 14, left: 22, width: 36, height: 40, zIndex: 2 },
  bottom:    { top: 5,  left: 58, width: 30, height: 72, zIndex: 1 },
  shoes:     { top: 68, left: 4,  width: 28, height: 22, zIndex: 1 },
  hat:       { top: 2,  left: 72, width: 22, height: 22, zIndex: 4 },
  glasses:   { top: 2,  left: 58, width: 20, height: 16, zIndex: 4 },
  bag:       { top: 68, left: 62, width: 26, height: 26, zIndex: 4 },
  accessory: { top: 55, left: 60, width: 20, height: 20, zIndex: 4 },
  default:   { top: 35, left: 35, width: 30, height: 30, zIndex: 2 },
};

// Maps actual category strings from the app (Category enum + slot keys + subCategory strings)
// to layout slot names. Category enum values: "top", "bottom", "outerwear", "footwear",
// "one_piece", "accessory". Slot key overrides: "shoes" (used instead of "footwear" in cards).
function categoryToSlot(category: string): string {
  const c = category.toLowerCase();

  if (["outerwear", "jacket", "coat", "overshirt", "blazer"].includes(c))
    return "outerwear";

  if (
    [
      "top",
      "shirt",
      "tshirt",
      "t-shirt",
      "blouse",
      "polo",
      "sweatshirt",
      "hoodie",
      "sweater",
      "tank",
      "kurta",
    ].includes(c)
  )
    return "top";

  if (
    [
      "bottom",
      "pants",
      "jeans",
      "trousers",
      "skirt",
      "chinos",
      "joggers",
      "shorts",
      "cargo",
      "trackpants",
    ].includes(c)
  )
    return "bottom";

  if (
    [
      "shoes",
      "footwear",
      "sneakers",
      "sneaker",
      "boots",
      "boot",
      "heels",
      "formal_shoe",
      "slide",
      "sandal",
      "loafer",
    ].includes(c)
  )
    return "shoes";

  if (["hat", "cap", "beanie"].includes(c)) return "hat";

  if (["sunglasses", "glasses"].includes(c)) return "glasses";

  if (["bag", "purse", "backpack"].includes(c)) return "bag";

  if (["accessory", "jewelry", "belt", "watch"].includes(c)) return "accessory";

  // one_piece / jumpsuit / set treated as a full-body bottom slot (left column, full height)
  if (["one_piece", "jumpsuit", "set"].includes(c)) return "bottom";

  return "default";
}

// subCategory values that don't render well as floating cutouts
const SKIP_RENDERING = new Set(["socks", "perfume"]);

export function computeFlatLayLayout(items: FlatLayItem[]): FlatLayResult[] {
  const slotCount: Record<string, number> = {};

  return items
    .filter((item) => !!item.imageUrl && !SKIP_RENDERING.has(item.category.toLowerCase()))
    .map((item) => {
      const slot = categoryToSlot(item.category);
      const count = slotCount[slot] ?? 0;
      slotCount[slot] = count + 1;

      const base = SLOT_DEFS[slot] ?? SLOT_DEFS.default;

      // Conflict offsets: each additional item in same slot shifts right and down
      let computedLeft = base.left + count * 12;
      const computedTop = base.top + count * 8;

      // Clamp: left + width must not exceed 96% so item stays within canvas
      if (computedLeft + base.width > 96) {
        computedLeft = 96 - base.width;
      }

      return {
        item,
        slot,
        style: {
          top: `${computedTop}%`,
          left: `${computedLeft}%`,
          width: `${base.width}%`,
          height: `${base.height}%`,
          zIndex: base.zIndex,
        },
      };
    });
}
