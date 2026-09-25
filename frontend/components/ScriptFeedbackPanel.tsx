"use client";
import { useState } from "react";
import type { Run } from "@/lib/types";
import { repairAction } from "@/lib/api";
export default function ScriptFeedbackPanel({
  run,
  busy,
  onAction,
}: {
  run: Run;
  busy: boolean;
  onAction: (label: string, action: () => Promise<Run>) => Promise<void>;
}) {
  const [note, setNote] = useState(""),
    [scope, setScope] = useState("full");
  const previous = run.scriptVersions?.at(-1);
  return (
    <section className="border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold">Revise the Story</h2>
      <p className="text-sm text-muted">
        Save any direct edits first. Feedback works from the saved version{" "}
        {run.script?.version}.
      </p>
      <label className="block">
        What would you like changed?
        <textarea
          className="block border rounded p-3 w-full"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="flex gap-2 flex-wrap">
        {[
          "Focus on the product",
          "Make it less technical",
          "Shorten to 30 seconds",
          "Change the opening",
        ].map((s) => (
          <button
            key={s}
            className="border rounded p-2 text-sm"
            onClick={() => {
              setNote(s);
              setScope(s === "Change the opening" ? "opening" : "full");
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <label>
        Revision scope
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="m-2 p-2 border rounded"
        >
          <option value="full">Whole script</option>
          <option value="opening">Opening only; preserve other beats</option>
        </select>
      </label>
      <button
        className="bg-accent text-accent-foreground rounded p-3 disabled:opacity-40"
        disabled={busy || !note.trim() || !run.script}
        onClick={() =>
          onAction("Revising script", () =>
            repairAction(run.id, "script/revise", {
              note,
              scope,
              scriptVersion: run.script?.version,
              briefRevision: run.effective?.revision,
            }),
          )
        }
      >
        Revise script
      </button>
      {run.script?.changeSummary && <p>{run.script.changeSummary}</p>}
      {previous && (
        <details>
          <summary>Previous and current versions</summary>
          <ul className="space-y-3 my-4">
            {run.script?.beats
              .filter(
                (b) =>
                  JSON.stringify(b) !==
                  JSON.stringify(previous.beats.find((p) => p.id === b.id)),
              )
              .map((b) => {
                const prior = previous.beats.find((p) => p.id === b.id);
                return (
                  <li
                    key={b.id}
                    className="border-l-2 border-accent pl-3 text-sm"
                  >
                    <strong>Changed {b.id}</strong>
                    {prior?.visual !== b.visual && (
                      <>
                        <p className="text-muted">
                          Before visual: {prior?.visual ?? "New beat"}
                        </p>
                        <p>After visual: {b.visual}</p>
                      </>
                    )}
                    {prior?.vo !== b.vo && (
                      <>
                        <p className="text-muted">
                          Before VO: {prior?.vo || "None"}
                        </p>
                        <p>After VO: {b.vo || "Visual only"}</p>
                      </>
                    )}
                  </li>
                );
              })}
          </ul>
          <button
            disabled={busy}
            className="border rounded p-3 mb-4"
            onClick={() =>
              onAction("Restoring previous version", () =>
                repairAction(run.id, "script/restore", {
                  restoreVersion: previous.version,
                  scriptVersion: run.script?.version,
                  briefRevision: run.effective?.revision,
                }),
              )
            }
          >
            Restore previous version
          </button>
          <div className="grid md:grid-cols-2 gap-4">
            <pre className="whitespace-pre-wrap text-xs">
              Version {previous.version}
              {"\n"}
              {previous.fullText}
            </pre>
            <pre className="whitespace-pre-wrap text-xs">
              Version {run.script?.version}
              {"\n"}
              {run.script?.fullText}
            </pre>
          </div>
        </details>
      )}
      <details>
        <summary>Version and feedback history</summary>
        {run.feedbackHistory?.map((f) => (
          <p key={f.id} className="my-3 text-sm">
            {f.note} — {f.status}: {f.summary ?? f.error}
          </p>
        ))}
        {run.scriptVersions?.map((s, i) => (
          <div key={i} className="border-t py-3">
            <span>
              Version {s.version} · {s.changeSummary ?? s.author}
            </span>
            <button
              disabled={busy}
              className="p-2 border rounded ml-3"
              onClick={() =>
                onAction("Restoring version", () =>
                  repairAction(run.id, "script/restore", {
                    restoreVersion: s.version,
                    scriptVersion: run.script?.version,
                    briefRevision: run.effective?.revision,
                  }),
                )
              }
            >
              Restore version {s.version}
            </button>
          </div>
        ))}
      </details>
    </section>
  );
}
