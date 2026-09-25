import { mode } from "./brief.js";
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
export function reviewSchema(keys: readonly string[]) {
  const dimension = z.object({
    score: z.number().min(0).max(100),
    explanation: z.string().trim().min(12).max(2000),
  });
  return z.object({
    criticalFailures: z.array(
      z.object({
        code: z.enum([
          "wrong_subject",
          "wrong_objective",
          "brand_contamination",
          "unsupported_claim",
        ]),
        evidence: z.string().min(12),
      }),
    ),
    dimensions: z
      .object(Object.fromEntries(keys.map((k) => [k, dimension])))
      .strict(),
  });
}
export function validateReview(
  value: unknown,
  keys: readonly string[],
  threshold: number,
  callIds: string[],
): QualityReview {
  const data = reviewSchema(keys).parse(value);
  const overall = Math.min(...keys.map((k) => data.dimensions[k].score));
  return {
    dimensions: data.dimensions,
    overall,
    threshold,
    passed: overall >= threshold && data.criticalFailures.length === 0,
    criticalFailures: data.criticalFailures,
    mode: mode(),
    callIds,
  };
}
export function reviewFixture(keys: readonly string[], weak: boolean) {
  return {
    criticalFailures: [],
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
