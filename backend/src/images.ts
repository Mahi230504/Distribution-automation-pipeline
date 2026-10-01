import sharp from "sharp";
import type { GenerateContentResponse, Part } from "@google/genai";
import { settings } from "./settings.js";
import { storage } from "./storage.js";

const xml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const lines = (value: string, width = 34, count = 3) => {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const result: string[] = [];
  for (const word of words) {
    if (!result.length || `${result.at(-1)} ${word}`.length > width)
      result.push(word);
    else result[result.length - 1] += ` ${word}`;
    if (result.length === count && words.indexOf(word) < words.length - 1) {
      result[count - 1] =
        `${result[count - 1].slice(0, Math.max(0, width - 1))}…`;
      break;
    }
  }
  return result.slice(0, count);
};
const seed = (value: string) =>
  [...value].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 2166136261);

interface FixtureImageContext {
  topic: string;
  label: string;
  scene: string;
  variation: number;
}
export async function storeImage(ownerId: string, runId: string, bytes: Buffer) {
  if (!bytes.length || bytes.length > settings.uploadBytes)
    throw new Error(
      `Image exceeds the ${Math.round(settings.uploadBytes / 1048576)} MB size limit.`,
    );
  let png: Buffer;
  try {
    const image = sharp(bytes, { limitInputPixels: 20000000, animated: false });
    const meta = await image.metadata();
    if (
      !["png", "jpeg", "webp"].includes(meta.format ?? "") ||
      (meta.pages ?? 1) > 1
    )
      throw new Error("Unsupported format");
    png = await image.rotate().png().toBuffer();
  } catch {
    throw new Error(
      "Upload a valid, non-animated PNG, JPEG or WebP image (maximum 20 million pixels).",
    );
  }
  const assetId = await storage.saveImage(ownerId, runId, png, { purpose: "image", mediaType: "image/png" });
  return { assetId, imageUrl: `/api/images/${assetId}` };
}
export async function imagePart(ownerId: string, assetId: string): Promise<Part> {
  return {
    inlineData: {
      mimeType: "image/png",
      data: (await storage.readImage(ownerId, assetId)).toString("base64"),
    },
  };
}
export async function imageFixture(
  ratio: string,
  context: FixtureImageContext,
): Promise<GenerateContentResponse> {
  const width = ratio === "9:16" ? 360 : 640,
    height = ratio === "9:16" ? 640 : 360;
  const value = seed(
    `${context.topic}|${context.scene}|${context.label}|${context.variation}`,
  );
  const hue = seed(context.topic) % 360,
    accentHue = (hue + 55) % 360,
    cardX = width * (0.09 + (value % 4) * 0.025),
    cardY = height * (0.22 + (context.variation % 3) * 0.035),
    cardW = width * 0.78,
    cardH = height * 0.42,
    topicLines = lines(context.topic, ratio === "9:16" ? 24 : 42, 2),
    sceneLines = lines(context.scene, ratio === "9:16" ? 33 : 58, 3),
    topicText = topicLines
      .map(
        (line, i) =>
          `<text x="24" y="${82 + i * 28}" fill="white" font-size="${ratio === "9:16" ? 22 : 25}" font-weight="700">${xml(line)}</text>`,
      )
      .join(""),
    sceneText = sceneLines
      .map(
        (line, i) =>
          `<text x="${cardX + 22}" y="${cardY + cardH + 46 + i * 23}" fill="white" opacity="0.92" font-size="${ratio === "9:16" ? 15 : 17}">${xml(line)}</text>`,
      )
      .join("");
  const isShoe = /shoe|sneaker|footwear|trainer/i.test(context.topic);
  const isClothing = /clothing|apparel|garment|shirt|hoodie|fashion/i.test(
    context.topic,
  );
  const isDashboard = /dashboard|analytics/i.test(context.topic);
  const subject = isClothing
    ? `<g transform="translate(${cardX + cardW * 0.15} ${cardY + cardH * 0.17}) scale(${cardW * 0.007} ${cardH * 0.007})"><path d="M25 0 L38 8 L62 8 L75 0 L100 22 L85 45 L75 36 L75 95 L25 95 L25 36 L15 45 L0 22 Z" fill="hsl(${accentHue} 78% 68%)"/><path d="M38 8 Q50 30 62 8" stroke="white" stroke-width="3" fill="none"/></g>`
    : isDashboard
      ? `<g transform="translate(${cardX + 20} ${cardY + 35})"><rect width="${cardW - 40}" height="${cardH - 70}" rx="8" fill="#121826"/><path d="M20 110 L45 80 L70 90 L95 40 L125 65 L165 25" fill="none" stroke="#78d5ac" stroke-width="7"/><text x="15" y="25" fill="white" font-size="16">ENGAGEMENT 91%</text></g>`
      : isShoe
        ? `<path d="M ${cardX + cardW * 0.16} ${cardY + cardH * 0.58} C ${cardX + cardW * 0.31} ${cardY + cardH * 0.35}, ${cardX + cardW * 0.42} ${cardY + cardH * 0.35}, ${cardX + cardW * 0.52} ${cardY + cardH * 0.57} L ${cardX + cardW * 0.82} ${cardY + cardH * 0.68} Q ${cardX + cardW * 0.9} ${cardY + cardH * 0.72}, ${cardX + cardW * 0.83} ${cardY + cardH * 0.82} L ${cardX + cardW * 0.2} ${cardY + cardH * 0.82} Q ${cardX + cardW * 0.1} ${cardY + cardH * 0.77}, ${cardX + cardW * 0.16} ${cardY + cardH * 0.58} Z" fill="hsl(${accentHue} 78% 68%)"/><path d="M ${cardX + cardW * 0.29} ${cardY + cardH * 0.55} L ${cardX + cardW * 0.56} ${cardY + cardH * 0.65}" stroke="white" stroke-width="7" stroke-linecap="round" stroke-dasharray="10 9"/>`
        : `<circle cx="${cardX + cardW * 0.34}" cy="${cardY + cardH * 0.48}" r="${Math.min(width, height) * 0.105}" fill="hsl(${accentHue} 78% 67%)"/><rect x="${cardX + cardW * 0.5}" y="${cardY + cardH * 0.3}" width="${cardW * 0.27}" height="${cardH * 0.42}" rx="18" fill="white" opacity="0.88"/><path d="M ${cardX + cardW * 0.17} ${cardY + cardH * 0.78} L ${cardX + cardW * 0.83} ${cardY + cardH * 0.78}" stroke="hsl(${accentHue} 72% 68%)" stroke-width="10" stroke-linecap="round"/>`;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 38% 18%)"/><stop offset="1" stop-color="hsl(${(hue + 35) % 360} 42% 9%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><text x="20" y="30" fill="white" opacity="0.78" font-size="14">TEST MODE • SIMULATED ${xml(context.label.toUpperCase())}</text>${topicText}<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="26" fill="hsl(${hue} 30% 27%)" stroke="hsl(${accentHue} 80% 68%)" stroke-width="3"/>${subject}${sceneText}<text x="20" y="${height - 18}" fill="white" opacity="0.64" font-size="12">Workflow fixture • no Gemini image call</text></svg>`;
  const data = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    candidates: [
      {
        content: {
          role: "model",
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: data.toString("base64"),
              },
            },
          ],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 1120 },
  } as GenerateContentResponse;
}
export function extractImage(response: GenerateContentResponse) {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const images = parts.filter(
    (p) => !p.thought && p.inlineData?.mimeType?.startsWith("image/"),
  );
  if (images.length !== 1 || !images[0].inlineData?.data)
    throw new Error(
      "The image model did not return exactly one image. No image was saved. Check the model response restrictions and try a new confirmed request.",
    );
  return Buffer.from(images[0].inlineData.data, "base64");
}
