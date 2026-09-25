import sharp from "sharp";
import type { GenerateContentResponse, Part } from "@google/genai";
import { settings } from "./settings.js";
import { storage } from "./storage.js";
export async function storeImage(bytes: Buffer) {
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
  const assetId = await storage.saveImage(png);
  return { assetId, imageUrl: `/api/images/${assetId}` };
}
export async function imagePart(assetId: string): Promise<Part> {
  return {
    inlineData: {
      mimeType: "image/png",
      data: (await storage.readImage(assetId)).toString("base64"),
    },
  };
}
export async function imageFixture(
  ratio: string,
  index: number,
): Promise<GenerateContentResponse> {
  const width = ratio === "9:16" ? 360 : 640,
    height = ratio === "9:16" ? 640 : 360;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#242b29"/><circle cx="${width * 0.72}" cy="${height * 0.25}" r="90" fill="#c48a3e"/><rect x="${width * 0.22}" y="${height * 0.4}" width="${width * 0.45}" height="${height * 0.4}" rx="24" fill="#657f93"/><circle cx="${width * 0.45}" cy="${height * 0.32}" r="40" fill="#dbb08c"/><rect x="${width * 0.05}" y="${height * 0.75}" width="${width * 0.9}" height="16" fill="#a0754c"/><path d="M ${width * 0.65} ${height * 0.62} h 44 v 40 h -44 z" fill="#eee7d9"/><text x="20" y="32" fill="white" font-size="16">TEST MODE • Frame ${index}</text><text x="20" y="${height - 20}" fill="white" font-size="14">Local storyboard fixture</text></svg>`;
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
