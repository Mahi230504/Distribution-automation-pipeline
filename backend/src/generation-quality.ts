import { z } from "zod";
import type { QualityReview } from "../../frontend/lib/types.js";
export const promptDimensions = [
  "clarity",
  "specificity",
  "faithfulness",
  "consistency_intent",
  "constraint_compliance",
] as const;
export const frameDimensions = [
  "adherence",
  "character_consistency",
  "consistency",
  "palette",
  "cleanliness",
  "script_adherence",
] as const;
export function validateReview(
  value: unknown,
  keys: readonly string[],
  threshold: number,
  callIds: string[],
): QualityReview {
  const dimension = z.object({
    score: z.number().min(0).max(100),
    explanation: z.string().trim().min(12).max(2000),
  });
  const data = z
    .object({
      dimensions: z
        .object(Object.fromEntries(keys.map((k) => [k, dimension])))
        .strict(),
    })
    .parse(value);
  const overall = Math.min(...keys.map((k) => data.dimensions[k].score));
  return {
    dimensions: data.dimensions,
    overall,
    threshold,
    passed: overall >= threshold,
    callIds,
  };
}
export function reviewFixture(keys: readonly string[], weak: boolean) {
  return {
    dimensions: Object.fromEntries(
      keys.map((k, i) => [
        k,
        {
          score: weak && i === 0 ? 48 : 86 + i,
          explanation:
            weak && i === 0
              ? "The subject is too small in the composition; use a tighter medium shot to make the action readable."
              : `The ${k.replaceAll("_", " ")} is supported by the stable recurring subject, coordinated palette and clearly framed action in this TEST MODE example.`,
        },
      ]),
    ),
  };
}
