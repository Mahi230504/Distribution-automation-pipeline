// Small formatting helpers shared across screens.

// Assumed speaking rate used for the non-AI script length check (docs/ARCHITECTURE.md, Story stage).
export const WORDS_PER_MINUTE = 150;

export function estimateSecondsFromWordCount(wordCount: number): number {
  return Math.round((wordCount / WORDS_PER_MINUTE) * 60);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function formatCurrency(amountUsd: number): string {
  if (amountUsd < 0.01 && amountUsd > 0) {
    return `$${amountUsd.toFixed(4)}`;
  }
  return `$${amountUsd.toFixed(2)}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function formatTimestamp(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function scriptLengthCheck(
  wordCount: number,
  targetSeconds: number
): { estimatedSeconds: number; label: string; withinTolerance: boolean } {
  const estimatedSeconds = estimateSecondsFromWordCount(wordCount);
  const withinTolerance = Math.abs(estimatedSeconds - targetSeconds) <= Math.max(5, targetSeconds * 0.15);
  const label = `${wordCount} words ≈ ${estimatedSeconds}s, target ${targetSeconds}s`;
  return { estimatedSeconds, label, withinTolerance };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
