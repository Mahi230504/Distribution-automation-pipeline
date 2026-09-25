import type { Script, ScriptBeat } from "../../frontend/lib/types.js";
import { settings } from "./settings.js";
export const words = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;
const stamp = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;
export function renderBeats(beats: ScriptBeat[]) {
  return beats
    .map(
      (b) =>
        `[${stamp(b.startSeconds)}–${stamp(b.endSeconds)}] VISUAL: ${b.visual}\nVO: ${b.vo}\nON-SCREEN: ${b.onScreen}`,
    )
    .join("\n\n");
}
export function makeScript(
  beats: ScriptBeat[],
  targetSeconds: number,
  version = 1,
  author: "ai" | "user" = "ai",
  fullText = renderBeats(beats),
): Script {
  const wordCount = words(beats.map((b) => b.vo).join(" "));
  return {
    beats,
    fullText,
    version,
    author,
    wordCount,
    targetSeconds,
    estimatedSeconds: Math.round(wordCount / settings.speakingRate),
    speakingRate: settings.speakingRate,
  };
}
export function parseScript(
  text: string,
  target: number,
  old?: Script | null,
): Script {
  const parts = [
    ...text.matchAll(
      /\[(\d+):(\d{2})\s*[–-]\s*(\d+):(\d{2})\]\s*([\s\S]*?)(?=\[\d+:\d{2}\s*[–-]|$)/g,
    ),
  ];
  if (!parts.length) {
    if (/\b(VISUAL|ON-SCREEN):/i.test(text))
      throw new Error(
        "Use [0:00–0:05] timestamps and VO: lines, or paste plain narration.",
      );
    return makeScript(
      [
        {
          id: "beat-1",
          startSeconds: 0,
          endSeconds: target,
          visual: "User supplied narration",
          vo: text,
          onScreen: "",
          factIds: old?.beats.flatMap((b) => b.factIds ?? []) ?? [],
        },
      ],
      target,
      (old?.version ?? 0) + 1,
      "user",
      text,
    );
  }
  const beats = parts.map((m, i) => {
    const body = m[5];
    const get = (label: string) =>
      body
        .match(
          new RegExp(
            label + ":\\s*([\\s\\S]*?)(?=\\s*(?:VISUAL|VO|ON-SCREEN):|$)",
            "i",
          ),
        )?.[1]
        .trim() ?? "";
    const start = +m[1] * 60 + +m[2],
      end = +m[3] * 60 + +m[4];
    if (end <= start || end > target)
      throw new Error(
        "Script timestamps must increase and fit the target duration.",
      );
    return {
      id: old?.beats[i]?.id ?? `beat-${i + 1}`,
      startSeconds: start,
      endSeconds: end,
      visual: get("VISUAL"),
      vo: get("VO"),
      onScreen: get("ON-SCREEN"),
      factIds:
        old?.beats[i]?.factIds ??
        old?.beats.flatMap((b) => b.factIds ?? []) ??
        [],
    };
  });
  return makeScript(beats, target, (old?.version ?? 0) + 1, "user", text);
}
