import type { Run } from "../../frontend/lib/types.js";
// Keep every fact-to-source edge while sending identical retrieved page text once.
export function reviewEvidence(run: Pick<Run, "facts" | "sources">) {
  const pages = new Map<string, { ids: string[]; exactPageText: string }>();
  for (const source of run.sources) {
    if (!run.facts.some((f) => f.sourceIds?.includes(source.id))) continue;
    const text = source.evidenceText ?? "";
    const identity = JSON.stringify([source.url, text]);
    const page = pages.get(identity);
    if (page) page.ids.push(source.id);
    else pages.set(identity, { ids: [source.id], exactPageText: text });
  }
  return {
    facts: run.facts.map((f) => ({
      id: f.id,
      claim: f.text,
      groundedAnswerSegments: f.supportedText,
      sourceIds: f.sourceIds,
    })),
    sourcePages: [...pages.values()],
  };
}
