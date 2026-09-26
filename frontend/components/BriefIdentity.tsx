"use client";
import { useState } from "react";
import type { Run, EffectiveBrief } from "@/lib/types";
import { repairAction } from "@/lib/api";
export default function BriefIdentity({
  run,
  busy,
  onAction,
}: {
  run: Run;
  busy: boolean;
  onAction: (label: string, action: () => Promise<Run>) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false),
    [subject, setSubject] = useState(run.effective?.subject ?? run.brief.topic),
    [objective, setObjective] = useState<EffectiveBrief["objective"]>(
      run.effective?.objective ?? "promote",
    ),
    [details, setDetails] = useState(run.effective?.productDetails ?? ""),
    [summary, setSummary] = useState(run.effective?.summary ?? ""),
    [visual, setVisual] = useState(run.effective?.visualPreferences ?? ""),
    [constraints, setConstraints] = useState(
      run.effective?.factualConstraints ?? "",
    ),
    [clearBrand, setClearBrand] = useState(false),
    [reopen, setReopen] = useState(false);
  const locked =
    !!run.storyApproval ||
    ["direction", "look", "storyboard", "pack", "done"].includes(
      run.currentStage,
    );
  return (
    <section className="p-5 border rounded-xl space-y-3">
      <p className="text-warning text-sm">
        {run.mode === "test"
          ? "SIMULATED RUN — research, images and scores are fixtures; not live evidence."
          : run.mode === "live"
            ? "LIVE RUN — estimates include provider calls."
            : "Historical run — provenance shown per saved call."}
      </p>
      <h2 className="font-semibold">What we’re creating</h2>
      <p>
        {run.effective?.summary ??
          "This older run needs an explicit content interpretation before further generation."}
      </p>
      {!!run.briefAssessment?.issues.length && (
        <div className="border rounded p-3 text-sm space-y-2" role="status">
          <p className="font-medium">
            Brief check:{" "}
            {run.briefAssessment.issues.length
              ? "Needs clarification"
              : "Ready"}
          </p>
          <p>{run.briefAssessment.rationale}</p>
          {run.briefAssessment.issues.map((issue, i) => (
            <p key={i}>
              {issue.explanation} <strong>{issue.question}</strong>
            </p>
          ))}
        </div>
      )}
      <details>
        <summary className="py-2 cursor-pointer">
          Brief details & Brand kit
        </summary>
        <p className="text-sm text-muted">
          Subject: {run.effective?.subject ?? run.brief.topic} · Objective:{" "}
          {run.effective?.objective ?? "Not confirmed"} · Platform:{" "}
          {run.brief.platform} (format only)
        </p>
        <p className="text-sm">
          Run Brand kit: {run.brandKit?.brandName || "None"} ·{" "}
          {run.brandKit?.characterDescription}
        </p>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            ["Product / subject details", run.effective?.productDetails],
            ["Audience", run.brief.audience],
            ["Visual preferences", run.effective?.visualPreferences],
            ["Factual constraints", run.effective?.factualConstraints],
            ["Brand tone", run.brandKit?.tone],
            ["Brand constraints", run.brandKit?.constraints],
            ["Palette", run.brandKit?.palette.join(", ")],
            ["Brief notes", run.brief.notes],
            ["Brand choice", run.effective?.brandSelection],
            ["Brief revision", String(run.effective?.revision ?? "Legacy")],
          ].map(([label, value]) => (
            <div key={label} className="border border-border p-3 rounded">
              <dt className="text-muted">{label}</dt>
              <dd className="break-words whitespace-pre-wrap">
                {value || "Not specified"}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      {run.storyApproval && (
        <p className="text-sm">
          Approved script v{run.storyApproval.scriptVersion}, brief v
          {run.storyApproval.briefRevision}
        </p>
      )}
      {locked ? (
        <button
          disabled={busy}
          className="border rounded p-3"
          onClick={() => setReopen(true)}
        >
          Reopen Story
        </button>
      ) : (
        <button className="border rounded p-3" onClick={() => setEdit(!edit)}>
          Edit brief
        </button>
      )}
      {reopen && (
        <div className="p-3 border border-warning rounded">
          <p>
            Reopening marks Direction, prompt, quotes, Look and Storyboard
            approvals outdated. Paid images and earlier versions stay in
            history. Nothing regenerates automatically.
          </p>
          <button
            disabled={busy}
            className="p-3 bg-accent rounded mt-3"
            onClick={() => {
              setReopen(false);
              setEdit(true);
              void onAction("Reopening Story", () =>
                repairAction(run.id, "story/reopen", {
                  confirmInvalidation: true,
                }),
              );
            }}
          >
            Confirm Reopen Story
          </button>
        </div>
      )}
      {(edit || !run.effective?.confirmed) && !locked && (
        <div className="grid gap-3">
          <label>
            Content subject
            <input
              className="block w-full border p-2 rounded"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label>
            Objective
            <select
              className="block w-full border p-2"
              value={objective}
              onChange={(e) =>
                setObjective(e.target.value as EffectiveBrief["objective"])
              }
            >
              {["promote", "explain", "demonstrate", "tell a story"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Product details (omit unknown claims)
            <textarea
              className="block w-full border p-2"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>
          <label>
            Visual preferences
            <textarea
              className="block w-full border p-2"
              value={visual}
              onChange={(e) => setVisual(e.target.value)}
            />
          </label>
          <label>
            Factual constraints
            <textarea
              className="block w-full border p-2"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
            />
          </label>
          <label>
            What we’re creating — confirm or edit
            <textarea
              className="block w-full border p-2"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={clearBrand}
              onChange={(e) => setClearBrand(e.target.checked)}
            />{" "}
            Continue without the Brand kit for this run; global kit unchanged
          </label>
          <button
            disabled={busy || summary.length < 10}
            className="p-3 bg-accent rounded"
            onClick={() =>
              onAction("Saving interpretation", () =>
                repairAction(
                  run.id,
                  "brief",
                  {
                    expectedRevision: run.effective?.revision ?? 0,
                    interpretation: {
                      subject,
                      objective,
                      productDetails: details,
                      visualPreferences: visual,
                      factualConstraints: constraints,
                      summary,
                      confirmed: true,
                    },
                    ...(clearBrand
                      ? {
                          brandKit: {
                            brandName: "",
                            palette: [],
                            characterDescription: "",
                            tone: "",
                            constraints: "",
                            preferredPlatforms: [],
                          },
                        }
                      : {}),
                  },
                  "PATCH",
                ),
              )
            }
          >
            Confirm this brief
          </button>
        </div>
      )}
      {!!run.history?.length && (
        <details>
          <summary>
            Outdated work preserved ({run.history.length} snapshots)
          </summary>
          {run.history.map((h, i) => (
            <div key={i} className="mt-3">
              <p>
                Brief v{h.effective?.revision ?? "legacy"} · script v
                {h.script?.version} · {h.at}
              </p>
              <pre className="text-xs whitespace-pre-wrap">
                {h.script?.fullText}
              </pre>
              {h.generation?.keys.map((k) => (
                <a
                  key={k.id}
                  href={`${process.env.NEXT_PUBLIC_API_URL}${k.imageUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block underline"
                >
                  Previous key frame {k.attempt}
                </a>
              ))}
              {h.generation?.board.flatMap((f) =>
                f.attempts.map((a) => (
                  <a
                    key={a.id}
                    href={`${process.env.NEXT_PUBLIC_API_URL}${a.imageUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block underline"
                  >
                    Previous frame {f.order + 1}, attempt {a.attempt}
                  </a>
                )),
              )}
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
