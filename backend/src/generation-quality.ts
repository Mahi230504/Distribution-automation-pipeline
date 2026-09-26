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
    visibleChecks: z
      .array(
        z.object({
          requirement: z.string().trim().min(8).max(500),
          observed: z.boolean(),
          evidence: z.string().trim().min(12).max(1500),
        }),
      )
      .min(2)
      .max(6)
      .optional(),
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
  if (keys.length === 6 && !data.visibleChecks)
    throw new Error(
      "Image review omitted observable checks; no pass accepted.",
    );
  const overall = Math.min(...keys.map((k) => data.dimensions[k].score));
  return {
    dimensions: data.dimensions,
    overall,
    threshold,
    passed:
      overall >= threshold &&
      data.criticalFailures.length === 0 &&
      (!data.visibleChecks || data.visibleChecks.every((c) => c.observed)),
    visibleChecks: data.visibleChecks,
    criticalFailures: data.criticalFailures,
    mode: mode(),
    callIds,
  };
}
export function reviewFixture(keys: readonly string[], weak: boolean) {
  return {
    ...(keys.length === 6
      ? {
          visibleChecks: [
            {
              requirement: "Requested subject appears",
              observed: true,
              evidence:
                "The controlled fixture depicts the requested subject in the foreground.",
            },
            {
              requirement: "Specific visible moment is shown",
              observed: !weak,
              evidence: weak
                ? "The required action is not readable at this distance."
                : "The controlled fixture shows the intended moment clearly.",
            },
          ],
        }
      : {}),
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

export function focusedFeedback(review?: QualityReview): string {
  if (!review) return "";
  return [
    ...(review.criticalFailures ?? []).map((f) => `${f.code}: ${f.evidence}`),
    ...(review.visibleChecks ?? [])
      .filter((c) => !c.observed)
      .map((c) => `Show ${c.requirement}. Observed problem: ${c.evidence}`),
    ...Object.entries(review.dimensions)
      .filter(([, d]) => d.score < review.threshold)
      .map(([name, d]) => `${name}: ${d.explanation}`),
  ].join(" ");
}

export function attachIntentCheck(
  review: QualityReview,
  audit: { passed: boolean; reason: string },
) {
  (review.visibleChecks ??= []).push({
    requirement: "Required visual outcome agrees with independent observation",
    observed: audit.passed,
    evidence: audit.reason,
  });
  review.passed = review.passed && audit.passed;
}
