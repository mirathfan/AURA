// Local development only. Creates one synthetic test account with a small
// closet in the LOCAL emulators started by start.sh. It refuses to run unless
// both emulator hosts are set, so it can never write to a real project.
//
// The test sign-in is written to scripts/local-backend/.test-account.local
// (ignored by git) rather than printed.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8189";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:19098";
for (const name of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name])) {
    throw new Error(`${name} must point at a local emulator.`);
  }
}

const admin = require(path.join(__dirname, "../../functions/node_modules/firebase-admin"));
admin.initializeApp({ projectId: "demo-aura-local" });
const db = admin.firestore();
const DAY = 24 * 60 * 60 * 1000;

function item(id, name, category, subcategory, colors, details) {
  const now = Date.now();
  return {
    id,
    data: {
      name,
      brand: "",
      isUnbranded: true,
      category,
      subCategory: subcategory,
      subcategory,
      colors,
      primaryColor: colors[0],
      pattern: "solid",
      material: details.material,
      status: details.status || "AVAILABLE",
      laundryStatus: details.laundry || "clean",
      wearCountSinceWash: details.wears || 0,
      ...(details.wornDaysAgo !== undefined ? { lastWornAt: now - details.wornDaysAgo * DAY } : {}),
      isDraft: false,
      itemLifecycleStatus: "ready",
      draftState: "ready",
      ingestionStatus: "done",
      ingestion: { status: "done" },
      createdAt: now,
      updatedAt: now,
      aiMetadata: {
        category: category === "footwear" ? "shoes" : category,
        subcategory,
        colors,
        material: details.material,
        fit: details.fit || "regular",
        formality: details.formality,
        warmth: details.warmth,
        styleTags: details.style,
        occasionTags: details.occasions,
        seasonTags: details.seasons || [],
        weatherTags: details.weather || [],
        searchAliases: [],
        confidence: 0.9,
        source: "deterministic",
      },
    },
  };
}

const CLOSET = [
  item("local-white-tee", "White Heavyweight Tee", "top", "t-shirt", ["white"], { material: "cotton", fit: "relaxed", formality: 1, warmth: 1, style: ["casual"], occasions: ["casual"], wornDaysAgo: 1 }),
  item("local-black-tee", "Black Boxy Tee", "top", "t-shirt", ["black"], { material: "cotton", fit: "oversized", formality: 1, warmth: 1, style: ["streetwear"], occasions: ["casual"] }),
  item("local-white-oxford", "White Oxford Shirt", "top", "oxford shirt", ["white"], { material: "cotton", formality: 3, warmth: 2, style: ["smart casual"], occasions: ["office", "dinner"] }),
  item("local-charcoal-knit", "Charcoal Merino Crewneck", "top", "sweater", ["charcoal"], { material: "merino wool", formality: 3, warmth: 4, style: ["smart casual"], occasions: ["dinner", "office"], seasons: ["winter"], weather: ["cold"] }),
  item("local-cream-hoodie", "Cream Heavy Hoodie", "top", "hoodie", ["cream"], { material: "cotton fleece", fit: "oversized", formality: 1, warmth: 4, style: ["streetwear"], occasions: ["casual"], weather: ["cold"] }),
  item("local-dark-denim", "Dark Indigo Straight Jeans", "bottom", "jeans", ["indigo"], { material: "denim", formality: 2, warmth: 3, style: ["casual"], occasions: ["casual", "dinner"] }),
  item("local-black-trousers", "Black Pleated Trousers", "bottom", "trousers", ["black"], { material: "wool blend", fit: "relaxed", formality: 3, warmth: 3, style: ["smart casual"], occasions: ["office", "dinner"] }),
  item("local-black-cargos", "Black Wide Cargos", "bottom", "cargo pants", ["black"], { material: "cotton ripstop", fit: "oversized", formality: 1, warmth: 2, style: ["streetwear"], occasions: ["casual"] }),
  item("local-white-sneakers", "White Leather Sneakers", "footwear", "sneakers", ["white"], { material: "leather", formality: 2, warmth: 2, style: ["casual"], occasions: ["casual"], wornDaysAgo: 0 }),
  item("local-brown-boots", "Brown Leather Chelsea Boots", "footwear", "boots", ["brown"], { material: "leather", formality: 3, warmth: 4, style: ["smart casual"], occasions: ["dinner", "office"], weather: ["cold", "rain"] }),
  item("local-tan-loafers", "Tan Suede Loafers", "footwear", "loafers", ["tan"], { material: "suede", formality: 3, warmth: 2, style: ["smart casual"], occasions: ["dinner"] }),
  item("local-black-derbies", "Black Leather Derbies", "footwear", "derby shoes", ["black"], { material: "leather", formality: 4, warmth: 2, style: ["smart"], occasions: ["office"] }),
  item("local-camel-coat", "Camel Wool Overcoat", "outerwear", "overcoat", ["camel"], { material: "wool", formality: 4, warmth: 5, style: ["smart casual"], occasions: ["dinner", "office"], weather: ["cold"], status: "IN_LAUNDRY", laundry: "in_laundry" }),
  item("local-black-puffer", "Black Down Puffer", "outerwear", "puffer jacket", ["black"], { material: "nylon down", fit: "oversized", formality: 1, warmth: 5, style: ["streetwear"], occasions: ["casual"], weather: ["cold"], wornDaysAgo: 1 }),
  item("local-suede-jacket", "Brown Suede Trucker Jacket", "outerwear", "jacket", ["brown"], { material: "suede", formality: 3, warmth: 3, style: ["smart casual"], occasions: ["dinner"] }),
  item("local-steel-watch", "Steel Dive Watch", "accessory", "watch", ["silver"], { material: "stainless steel", formality: 3, warmth: 1, style: ["classic"], occasions: ["casual", "office", "dinner"] }),
];

async function main() {
  const email = "local-test@aura.test";
  // Keep the same generated password across re-seeds so a running app build
  // does not need restarting.
  const accountFile = path.join(__dirname, ".test-account.local");
  const previous = fs.existsSync(accountFile)
    ? (fs.readFileSync(accountFile, "utf8").match(/^password=(.+)$/m) || [])[1]
    : undefined;
  const password = previous || crypto.randomBytes(12).toString("base64url");
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password });
  } catch {
    user = await admin.auth().createUser({ email, password, emailVerified: true, displayName: "Local Tester" });
  }
  const uid = user.uid;
  const preferences = {
    displayName: "Local Tester",
    firstName: "Local",
    onboardingCompleted: true,
    wardrobeMode: "masculine",
    styleAesthetics: ["Streetwear", "Casual", "Smart Casual"],
    preferredStyles: ["Streetwear", "Casual", "Smart Casual"],
    favoriteColors: ["black", "cream"],
    preferredFit: "relaxed",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  // The app keeps preferences under profilePreferences on the user document.
  await db.doc(`users/${uid}`).set({
    displayName: "Local Tester",
    name: "Local Tester",
    profilePreferences: preferences,
    profileUpdatedAt: Date.now(),
  }, { merge: true });
  const batch = db.batch();
  for (const entry of CLOSET) batch.set(db.doc(`users/${uid}/items/${entry.id}`), entry.data);
  await batch.commit();
  fs.writeFileSync(
    accountFile,
    `email=${email}\npassword=${password}\nuid=${uid}\n`,
    { mode: 0o600 },
  );
  console.log(`Seeded ${CLOSET.length} items for the local test account. Sign-in details are in scripts/local-backend/.test-account.local`);
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
