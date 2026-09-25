import { GenerateContentResponse } from "@google/genai";
import type { Brief } from "../../frontend/lib/types.js";

interface GroundingFixture {
  query: string;
  sourceTitle: string;
  redirectUrl: string;
  directUrl: string;
}

export function response(
  data: unknown,
  grounding = false,
  groundingFixture?: GroundingFixture,
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
    const fixture =
      groundingFixture ??
      ({
        query: "sample topic facts",
        sourceTitle: "TEST MODE topic guide",
        redirectUrl:
          "https://vertexaisearch.cloud.google.com/grounding-api-redirect/vpo-test-topic",
        directUrl: "https://example.com/vpo-test-topic",
      } satisfies GroundingFixture);
    r.candidates[0].groundingMetadata = {
      webSearchQueries: [fixture.query],
      groundingChunks: [
        {
          web: {
            uri: fixture.redirectUrl,
            title: `${fixture.sourceTitle} — overview`,
          },
        },
        {
          web: {
            uri: fixture.directUrl,
            title: `${fixture.sourceTitle} — audience notes`,
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

const clean = (value: string, fallback: string) =>
  value.replace(/\s+/g, " ").trim().slice(0, 120) || fallback;
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "topic";

export function storyFixture(brief: Pick<Brief, "topic" | "audience">) {
  const topic = clean(brief.topic, "the selected topic");
  const audience = clean(brief.audience, "the intended audience");
  const facts = [
    `${topic} options can be compared by features, price, and fit for the buyer's needs.`,
    `Clear positioning helps people understand who a ${topic} offer is for and why it is different.`,
    `Consistent visual identity makes a ${topic} offer easier to recognise across repeated encounters.`,
    `Demonstrations and customer evidence can reduce uncertainty when ${audience} evaluate ${topic}.`,
    `Testing one campaign variable at a time makes ${topic} marketing results easier to compare.`,
    `Every person interested in ${topic} wants exactly the same product and message.`,
  ];
  const topicSlug = slug(topic);
  return {
    facts,
    evidence:
      facts.slice(0, 4).join(" ") +
      ` ${facts[4].replace("Testing", "Comparisons are clearer when teams test")}`,
    grounding: {
      query: `${topic} facts for ${audience}`,
      sourceTitle: `TEST MODE ${topic}`,
      redirectUrl: `https://vertexaisearch.cloud.google.com/grounding-api-redirect/vpo-test-${topicSlug}`,
      directUrl: `https://example.com/vpo-test-research/${topicSlug}`,
    } satisfies GroundingFixture,
  };
}
