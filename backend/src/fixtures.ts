import { GenerateContentResponse } from "@google/genai";
export function response(
  data: unknown,
  grounding = false,
): GenerateContentResponse {
  const text = JSON.stringify(data);
  const r = new GenerateContentResponse();
  r.candidates = [{ content: { role: "model", parts: [{ text }] } }];
  r.usageMetadata = {
    promptTokenCount: 400,
    candidatesTokenCount: 200,
    totalTokenCount: 600,
  };
  if (grounding) {
    const facts = (data as { facts: { text: string }[] }).facts;
    r.candidates[0].groundingMetadata = {
      webSearchQueries: ["coffee brewing facts"],
      groundingChunks: [
        {
          web: {
            uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/vpo-test-coffee",
            title: "Coffee brewing guide",
          },
        },
        {
          web: {
            uri: "https://www.ncausa.org/About-Coffee/How-to-Brew-Coffee",
            title: "National Coffee Association",
          },
        },
      ],
      groundingSupports: facts
        .slice(0, 5)
        .map((f, i) => ({
          segment: {
            text: f.text,
            startIndex: text.indexOf(f.text),
            endIndex: text.indexOf(f.text) + f.text.length,
          },
          groundingChunkIndices: [i % 2],
        })),
    };
  }
  return r;
}
export const fixtureFacts = [
  "Brewing coffee extracts soluble compounds from ground coffee with water.",
  "Grind size affects how quickly coffee extracts.",
  "Water temperature affects coffee extraction.",
  "A consistent coffee-to-water ratio helps make repeatable brews.",
  "Changing one brewing variable at a time can make comparisons easier.",
  "Every coffee drinker prefers exactly the same brewing recipe.",
];
export const fixtureEvidence =
  fixtureFacts.slice(0, 4).join(" ") +
  " Comparing recipes is easier when the other brewing variables stay constant.";
