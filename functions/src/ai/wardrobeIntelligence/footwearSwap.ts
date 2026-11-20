const kinds = {
  boots: "boots?",
  sneakers: "sneakers?|trainers?",
  loafers: "loafers?",
  derbies: "derb(?:y|ies)",
  oxfords: "oxfords?",
  sandals: "sandals?",
  slides: "slides?",
  heels: "heels?",
} as const;

export type FootwearKind = keyof typeof kinds;
const kindNames = Object.keys(kinds) as FootwearKind[];
const nouns = Object.values(kinds).join("|");
// Keep both ends of a swap within one instruction. In “swap the shoes for a
// cold walk”, “for” introduces a purpose and has no footwear destination.
const modifiers = "(?:(?!(?:and|but|or|not|no|without|with|for|to|into|of)\\b)[a-z]+\\s+){0,5}";
const swap = new RegExp(
  `\\b(?:swap|switch|trade|replace|change)\\s+(?:out\\s+)?${modifiers}(?:shoes?|footwear|${nouns})\\s+` +
  `(?:for|with|to|into)\\s+${modifiers}(${nouns})\\b`, "i",
);

export function matchesFootwearKind(kind: FootwearKind, item: {
  name?: unknown; subcategory?: unknown; aiMetadata?: { subcategory?: unknown } | null;
}): boolean {
  const text = [item.name, item.subcategory, item.aiMetadata?.subcategory].filter(Boolean).join(" ").replace(/[_-]/g, " ");
  return new RegExp(`\\b(?:${kinds[kind]})\\b`, "i").test(text);
}

export function parseFootwearSwap(text: string) {
  const match = swap.exec(text);
  if (!match) return undefined;
  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();
  if (/\b(?:never|not|don['’]?t)\s*$/i.test(before) || /^or\b/i.test(after)) return undefined;
  const kind = kindNames.find((entry) => matchesFootwearKind(entry, { name: match[1] }));
  if (!kind) return undefined;
  const onlyChange = /^(?:(?:please|(?:can|could) you)\s*)*$/i.test(before) && /^(?:please)?[.!?]*$/i.test(after);
  return { kind, onlyChange };
}
