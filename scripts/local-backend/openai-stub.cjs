// Local development only. Loaded into the Firebase Functions emulator with
// NODE_OPTIONS=--require so that NO request ever reaches a real AI provider:
// every call to api.openai.com is answered here with a deterministic, clearly
// synthetic response. The backend's own consent and endpoint checks still run
// unchanged, because they sit in front of fetch.
//
// This file is never part of a deploy: it lives outside functions/ and is only
// referenced by scripts/local-backend/start.sh.

const DELAY_MS = Number(process.env.AURA_STUB_DELAY_MS || 1500);
const realFetch = globalThis.fetch;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function embeddingResponse(body) {
  const dimensions = Number(body.dimensions) || 1536;
  const vector = new Float32Array(dimensions).fill(0.01);
  const embedding = body.encoding_format === "base64"
    ? Buffer.from(vector.buffer).toString("base64")
    : Array.from(vector);
  return json({
    object: "list",
    model: body.model || "stub-embedding",
    data: [{ object: "embedding", index: 0, embedding }],
    usage: { prompt_tokens: 0, total_tokens: 0 },
  });
}

function pickOutfit(prompt) {
  const byRole = prompt.candidatesByRole || {};
  const avoid = new Set((prompt.hardConstraints && prompt.hardConstraints.avoidItemIds) || []);
  const required = new Set((prompt.hardConstraints && prompt.hardConstraints.requiredItemIds) || []);
  const all = Object.values(byRole).flat();
  const chosen = new Map();
  for (const item of all) if (required.has(item.itemId)) chosen.set(item.allowedRole, item);
  const first = (role) => (byRole[role] || []).find((item) => !avoid.has(item.itemId));
  for (const role of ["top", "bottom", "footwear"]) {
    if (!chosen.has(role)) {
      const item = first(role);
      if (item) chosen.set(role, item);
    }
  }
  const weather = String(prompt.weatherNow || "").toLowerCase();
  if (!chosen.has("outerwear") && /freezing|cold|cool|rain|snow/.test(weather)) {
    const layer = first("outerwear");
    if (layer) chosen.set("outerwear", layer);
  }
  return [...chosen.values()];
}

function responsesResponse(body) {
  let prompt = {};
  try {
    const text = body.input[1].content[0].text;
    prompt = JSON.parse(String(text).split("\n\nRepair instruction:")[0]);
  } catch {
    prompt = {};
  }
  const items = pickOutfit(prompt);
  const names = items.map((item) => String(item.name || "piece").toLowerCase());
  const payload = {
    stylistMessage: names.length
      ? `Local test reply: the ${names.slice(0, 3).join(", ")} work together for this.`
      : "Local test reply.",
    outfits: [{
      title: "Local Test Look",
      vibe: "synthetic, local test",
      occasion: String(prompt.occasion || "everyday"),
      formality: "casual",
      items: items.map((item) => ({ itemId: item.itemId, role: item.allowedRole, reason: "picked by the local stand-in" })),
      explanation: "This outfit was produced by the local stand-in model, not by a real AI model. It exists to test the app.",
      stylingTips: [],
      missingItems: [],
      confidence: 0.5,
    }],
  };
  return json({
    id: "resp_local_stub",
    object: "response",
    status: "completed",
    model: body.model || "stub-model",
    output: [{
      id: "msg_local_stub",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: JSON.stringify(payload), annotations: [] }],
    }],
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  });
}

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname !== "api.openai.com" && url.hostname !== "serpapi.com") return realFetch(input, init);
  let body = {};
  try {
    body = JSON.parse(String((init && init.body) || "{}"));
  } catch {
    body = {};
  }
  if (url.pathname.endsWith("/embeddings")) return embeddingResponse(body);
  if (url.pathname.endsWith("/responses")) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    return responsesResponse(body);
  }
  // Anything else is refused locally rather than sent to a provider.
  return json({ error: { message: "Blocked by the local stand-in: no provider calls in local development." } }, 501);
};

console.log(`[local-backend] AI provider calls are answered locally (delay ${DELAY_MS} ms). Nothing is sent to OpenAI.`);
