"use client";

import { useState } from "react";
import type { Run, ImageQuote, QualityReview, ImageAttempt } from "@/lib/types";
import {
  repairAction,
  approveStory,
  selectDirection,
  requestImageQuote,
  confirmImageQuote,
  approveKey,
  rejectKey,
  approveStoryboard,
  uploadKeyFrame,
  resumeRun,
} from "@/lib/api";
import LoadingState from "./LoadingState";
import ProtectedImage from "./ProtectedImage";

const button =
  "rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed";
const secondary =
  "rounded-lg border border-border px-4 py-3 text-sm disabled:opacity-40";
const box = "rounded-xl border border-border bg-surface p-4 sm:p-6 min-w-0";
const money = (n: number) => `$${n.toFixed(4)}`;
const label = (s: string) => s.replaceAll("_", " ");
function Scores({ review }: { review?: QualityReview }) {
  if (!review) return <p className="text-sm text-muted">Review pending</p>;
  return (
    <div className="space-y-3">
      <p className={review.passed ? "text-accent-strong" : "text-warning"}>
        Quality {review.overall}/100 ·{" "}
        {review.passed ? "Passed" : "Quality threshold not reached"}
      </p>
      {review.criticalFailures?.map((f, i) => (
        <p key={i} role="alert" className="text-warning">
          Critical: {label(f.code)} — {f.evidence}
        </p>
      ))}
      {review.visibleChecks
        ?.filter((c) => !c.observed)
        .map((c, i) => (
          <p key={i} role="alert" className="text-warning text-sm">
            {c.requirement}: {c.evidence}
          </p>
        ))}
      <details>
        <summary className="cursor-pointer py-2 text-sm text-muted">
          Review details
        </summary>
        {review.visibleChecks?.map((check, i) => (
          <div key={i} className="border rounded p-2 text-sm">
            <strong>
              {check.observed ? "Observed" : "Not verified"}:{" "}
              {check.requirement}
            </strong>
            <p>{check.evidence}</p>
          </div>
        ))}
        {Object.entries(review.dimensions).map(([name, d]) => (
          <div key={name}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="capitalize">{label(name)}</span>
              <strong>{d.score}/100</strong>
            </div>
            <div className="h-1.5 my-2 rounded bg-background">
              <div
                className="h-full rounded bg-accent"
                style={{ width: `${d.score}%` }}
              />
            </div>
            <p className="text-sm text-muted">{d.explanation}</p>
          </div>
        ))}
      </details>
    </div>
  );
}
function Calls({ run, ids }: { run: Run; ids: string[] }) {
  return (
    <div className="space-y-1 text-xs text-muted break-words">
      {run.aiCallLog
        .filter((c) => ids.includes(c.id))
        .map((c) => (
          <p key={c.id}>
            {c.model} · {c.task} · {c.inputTokens ?? "unknown"} input /{" "}
            {c.outputTokens ?? "unknown"} output tokens · {c.imageCount ?? 0}{" "}
            images · estimate {money(c.estimatedCostUsd)} · {c.outcome}
          </p>
        ))}
    </div>
  );
}
function ImageView({ image, run }: { image: ImageAttempt; run: Run }) {
  return (
    <div className="space-y-3">
      <ProtectedImage
        src={image.imageUrl}
        alt={`Storyboard image, attempt ${image.attempt}`}
        className="max-h-[480px] w-full rounded-lg object-contain bg-background"
      />
      <p className="text-sm">
        {image.mode === "test"
          ? "SIMULATED"
          : image.mode === "live"
            ? "LIVE"
            : "PROVENANCE UNKNOWN"}{" "}
        · Attempt {image.attempt} · {image.source} · {image.origin}{" "}
        {image.approval ? `· ${image.approval}` : ""}
      </p>
      <details>
        <summary className="cursor-pointer py-2 text-sm text-muted">
          Image details & history
        </summary>
        {image.note && (
          <p className="text-sm text-muted break-words">Change: {image.note}</p>
        )}
        {image.observation && (
          <details>
            <summary>Independent pixel observation</summary>
            <p className="text-sm">{image.observation.description}</p>
            {image.observation.uncertainties.map((u, i) => (
              <p className="text-sm text-warning" key={i}>
                Uncertain: {u}
              </p>
            ))}
          </details>
        )}
        {image.intentAudit && (
          <p className="text-sm">
            Independent intent check:{" "}
            {image.intentAudit.passed ? "Passed" : "Not satisfied"} —{" "}
            {image.intentAudit.reason}
          </p>
        )}

        {image.stillPrompt && (
          <details>
            <summary>Exact still-image instructions</summary>
            <p className="text-sm whitespace-pre-wrap">{image.stillPrompt}</p>
          </details>
        )}
        <Calls run={run} ids={image.callIds} />
      </details>
      {image.review && <Scores review={image.review} />}
    </div>
  );
}
export default function GenerationWorkspace({
  run,
  busy,
  onAction,
}: {
  run: Run;
  busy: boolean;
  onAction: (label: string, action: () => Promise<Run>) => Promise<void>;
}) {
  const g = run.generation;
  const [tab, setTab] = useState<"direction" | "look" | "storyboard" | null>(
    null,
  );
  const [direction, setDirection] = useState(run.selectedDirectionId ?? "");
  const [note, setNote] = useState(run.directionNote);
  const [change, setChange] = useState("");
  const [promptNote, setPromptNote] = useState("");
  const [frameNotes, setFrameNotes] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<ImageQuote | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const current = !g?.directionsReady
    ? "direction"
    : (tab ??
      (run.currentStage === "look"
        ? "look"
        : run.currentStage === "storyboard"
          ? "storyboard"
          : "direction"));
  const prompt = g?.prompts.find((p) => p.id === g.activePromptId);
  const key = g?.keys.find((k) => k.id === g.activeKeyId);
  async function estimate(
    action: ImageQuote["action"],
    note = "",
    frameId?: string,
    resume = false,
  ) {
    setError("");
    setRequesting(true);
    try {
      setQuote(await requestImageQuote(run.id, action, note, frameId, resume));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRequesting(false);
    }
  }
  async function upload(file?: File, productReference = false) {
    if (!file) return;
    setError("");
    if (file.size > (g?.limits.uploadBytes ?? 5242880)) {
      setError("This image exceeds the upload size limit.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read this image."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      await onAction("Saving uploaded reference", () =>
        productReference
          ? repairAction(run.id, "product-reference", { dataUrl })
          : uploadKeyFrame(run.id, dataUrl),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap gap-2" aria-label="Generation stages">
        {(["direction", "look", "storyboard"] as const).map((t) => (
          <button
            key={t}
            className={current === t ? button : secondary}
            onClick={() => setTab(t)}
            disabled={
              (t === "look" && !prompt) ||
              (t === "storyboard" && !g?.approvedKeyId)
            }
          >
            {label(t).replace(/^./, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-400 p-4 text-red-300"
        >
          {error}
        </div>
      )}
      {requesting && <LoadingState label="Preparing itemised estimate" />}
      {quote && (
        <section className={box} aria-label="Cost confirmation">
          <h2 className="text-lg font-semibold">Confirm image cost</h2>
          <p className="my-2 text-sm text-muted">
            This confirms only {label(quote.action)}. Includes automatic
            replacements and up to two rate-limit retries per call. Estimated
            allowance, not a provider invoice.
          </p>
          <ul className="space-y-3 my-4">
            {quote.items.map((i) => (
              <li key={i.label} className="text-sm break-words">
                {i.quantity} × {i.label}
                <strong className="block">{money(i.amountUsd)}</strong>
              </li>
            ))}
          </ul>
          <p className="font-semibold mb-4">
            Up to {quote.maxImages} image request attempts · maximum estimate{" "}
            {money(quote.amountUsd)}
          </p>
          {quote.note && <p className="mb-4">Your change: {quote.note}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                const q = quote;
                setQuote(null);
                setTab(
                  q.action === "board" || q.action === "frame-regenerate"
                    ? "storyboard"
                    : "look",
                );
                void onAction("Confirming generation", () =>
                  confirmImageQuote(run.id, q),
                );
              }}
            >
              Confirm and generate
            </button>
            <button className={secondary} onClick={() => setQuote(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}
      {current === "direction" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold">
              Choose a creative direction
            </h2>
            <p className="text-muted text-sm mt-2">
              The approved Story stays intact. Choose the approach that feels
              right for your audience.
            </p>
          </div>
          {!g?.directionsReady ? (
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                onAction("Developing directions", () =>
                  approveStory(
                    run.id,
                    run.script?.version,
                    run.effective?.revision,
                  ),
                )
              }
            >
              Generate three directions
            </button>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                {run.directions.map((d) => (
                  <button
                    key={d.id}
                    aria-pressed={direction === d.id}
                    className={`${box} text-left ${direction === d.id ? "ring-2 ring-accent" : ""}`}
                    disabled={busy}
                    onClick={() => setDirection(d.id)}
                  >
                    <h3 className="font-semibold text-lg mb-3">{d.name}</h3>
                    {(
                      ["hook", "angle", "look", "mood", "summary"] as const
                    ).map((k) => (
                      <p key={k} className="text-sm mb-3">
                        <span className="block text-muted capitalize">{k}</span>
                        {d[k]}
                      </p>
                    ))}
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                Optional direction note
                <textarea
                  className="mt-2 w-full rounded-lg border border-border bg-surface p-3"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={2000}
                  placeholder="Make it more playful"
                />
              </label>
              <button
                className={button}
                disabled={busy || !direction}
                onClick={() => {
                  setTab(null);
                  setQuote(null);
                  void onAction("Writing and reviewing your prompt", () =>
                    selectDirection(run.id, direction, note),
                  );
                }}
              >
                Use this direction
              </button>
              {run.selectedDirectionId && (
                <p className="text-sm text-muted">
                  Saved choice:{" "}
                  {
                    run.directions.find((d) => d.id === run.selectedDirectionId)
                      ?.name
                  }{" "}
                  · {run.directionNote || "No additional note"}. Changing it
                  replaces the active prompt and invalidates Look approval and
                  Storyboard.
                </p>
              )}
            </>
          )}
        </section>
      )}
      {prompt && (current === "direction" || current === "look") && (
        <section className={box}>
          <h2 className="text-lg font-semibold mb-3">
            Your video prompt · version {prompt.attempt}
          </h2>
          <details>
            <summary className="cursor-pointer py-2 text-sm">
              View optimized prompt
            </summary>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 mb-4">
              {prompt.prompt}
            </p>
            <p className="text-sm mb-4">
              <strong>Avoid:</strong> {prompt.negativePrompt}
            </p>
          </details>
          <Scores review={prompt.review} />
          <p className="text-sm text-warning">
            {prompt.mode === "test"
              ? "SIMULATED prompt review"
              : prompt.mode === "live"
                ? "Live model review — inspect the result; a score is not proof."
                : "Historical review"}
          </p>
          {prompt.stopReason && (
            <p className="text-warning">{prompt.stopReason}</p>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer py-2 text-sm">
              Want to change the creative approach?
            </summary>
            <label className="block mt-4">
              What would you like changed?
              <textarea
                value={promptNote}
                onChange={(e) => setPromptNote(e.target.value)}
                className="block w-full p-3 border rounded"
              />
            </label>
            <button
              className={button}
              disabled={busy || !promptNote.trim()}
              onClick={() =>
                onAction("Revising prompt", () =>
                  repairAction(run.id, "prompt/revise", {
                    promptId: prompt.id,
                    note: promptNote,
                  }),
                )
              }
            >
              Revise prompt
            </button>
          </details>
          <details>
            <summary className="cursor-pointer py-2 text-sm text-muted">
              Generation costs
            </summary>
            <Calls run={run} ids={prompt.callIds} />
          </details>
          <details className="mt-5">
            <summary className="cursor-pointer py-2">
              Every prompt version ({g!.prompts.length})
            </summary>
            {g!.prompts.map((p) => (
              <div key={p.id} className="border-t border-border py-4 space-y-3">
                <h3>
                  Revision {p.revision}, attempt {p.attempt} · {p.origin}
                  {p.id === prompt.id ? " · displayed" : ""}
                </h3>
                <p className="text-sm text-muted">
                  Direction:{" "}
                  {run.directions.find((d) => d.id === p.directionId)?.name ??
                    "Saved direction"}{" "}
                  · {p.note || "No added note"}
                </p>
                <p className="whitespace-pre-wrap text-sm break-words">
                  {p.prompt}
                </p>
                <p className="text-sm">Avoid: {p.negativePrompt}</p>
                <Scores review={p.review} />
                <Calls run={run} ids={p.callIds} />
              </div>
            ))}
          </details>
        </section>
      )}
      {current === "look" && (
        <section className={box}>
          <h2 className="text-xl font-semibold mb-4">Set the Look</h2>
          {!key && (
            <label className="block mb-4">
              Optional product photo — identity reference for generation, not a
              finished Look
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => void upload(e.target.files?.[0], true)}
              />
              {run.productReference && <span>Product reference saved.</span>}
            </label>
          )}
          {key ? (
            <ImageView image={key} run={run} />
          ) : (
            <p className="text-muted mb-4">
              Generate one key frame, or upload your own reference at no AI
              cost.
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-5">
            {!key && (
              <button
                className={button}
                disabled={busy || requesting || !prompt}
                onClick={() => estimate("key")}
              >
                Estimate key frame
              </button>
            )}
            {key && (
              <>
                <button
                  className={button}
                  disabled={
                    busy ||
                    key.approval === "approved" ||
                    (key.source === "generated" && !key.review?.passed)
                  }
                  onClick={() => {
                    setTab("storyboard");
                    void onAction("Approving Look", () =>
                      approveKey(run.id, key.id),
                    );
                  }}
                >
                  Approve look
                </button>
                <button
                  className={secondary}
                  disabled={busy}
                  onClick={() =>
                    onAction("Rejecting Look", () => rejectKey(run.id))
                  }
                >
                  Reject look
                </button>
              </>
            )}
            <label className={`${secondary} cursor-pointer`}>
              Upload finished Look (skip generation)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="block mt-2 max-w-full text-xs"
                disabled={busy || !prompt}
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="text-xs text-muted mt-3">
            PNG, JPEG or WebP · up to{" "}
            {Math.round((g?.limits.uploadBytes ?? 5242880) / 1048576)} MB.
            Actual file contents are checked on the server.
          </p>
          {key && (
            <div className="mt-5">
              <label className="block text-sm">
                Change note
                <textarea
                  className="mt-2 w-full rounded-lg border border-border bg-background p-3"
                  value={change}
                  onChange={(e) => setChange(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <button
                className={secondary}
                disabled={busy || requesting || !change.trim()}
                onClick={() => estimate("key-regenerate", change)}
              >
                Estimate Look change
              </button>
            </div>
          )}
          {!!g?.keys.length && (
            <details className="mt-5">
              <summary className="cursor-pointer py-2">
                Every key-frame version ({g.keys.length})
              </summary>
              <div className="grid gap-5 sm:grid-cols-2 mt-4">
                {g.keys.map((k) => (
                  <ImageView key={k.id} image={k} run={run} />
                ))}
              </div>
            </details>
          )}
        </section>
      )}
      {current === "storyboard" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Storyboard</h2>
            <p className="text-sm text-muted mt-2">
              {g?.boardApprovedAt
                ? "Approved — Session 10.3 complete."
                : "The approved key frame anchors the remaining frames."}{" "}
              Automatic replacements: up to {g?.limits.autoRegenerations} per
              frame. Manual changes used: {g?.manualRegenerations}/
              {g?.limits.manualRegenerations}.
            </p>
          </div>
          {!g?.board.length ? (
            <button
              className={button}
              disabled={busy || requesting || !g?.approvedKeyId}
              onClick={() => estimate("board")}
            >
              Estimate Storyboard
            </button>
          ) : (
            <>
              <div className={box}>
                <h3 className="font-semibold mb-3">
                  Saved beat-to-frame mapping
                </h3>
                <p className="text-sm text-muted mb-3">
                  All {run.script?.beats.length} beats are preserved in{" "}
                  {g.board.length} frames, including the opening and payoff. A
                  grouped frame represents several beats; it does not replace or
                  shorten the script.
                </p>
                {g.board.map((f) => (
                  <p key={f.id} className="text-sm py-2 break-words">
                    <strong>
                      Frame {f.order + 1}
                      {f.isKey ? " · approved key frame" : ""}
                    </strong>{" "}
                    →{" "}
                    {f.beatIds
                      .map(
                        (id) =>
                          `beat ${run.script!.beats.findIndex((b) => b.id === id) + 1}`,
                      )
                      .join(", ")}
                    <span className="block text-muted">{f.instruction}</span>
                  </p>
                ))}
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                {g.board.map((f) => {
                  const selected =
                    f.attempts.find((a) => a.id === f.selectedAttemptId) ??
                    f.attempts.at(-1);
                  return (
                    <article key={f.id} className={box}>
                      <h3 className="font-semibold mb-3">
                        Frame {f.order + 1}
                        {f.isKey ? " · approved Look" : ""}
                      </h3>
                      {selected ? (
                        <ImageView image={selected} run={run} />
                      ) : (
                        <p>Waiting for generation</p>
                      )}
                      {f.restoredFromAttemptId && (
                        <p className="text-sm text-muted mt-3">
                          Previous passing attempt restored. Newer attempts
                          remain in history; no new generation cost.
                        </p>
                      )}
                      {f.retryLimitReached && (
                        <p className="text-warning mt-3">
                          Retry limit reached. Showing the best available result
                          with its real score.
                        </p>
                      )}
                      {!f.isKey && (
                        <div className="mt-4">
                          <label className="block text-sm">
                            Change for frame {f.order + 1}
                            <textarea
                              value={frameNotes[f.id] ?? ""}
                              maxLength={2000}
                              onChange={(e) =>
                                setFrameNotes({
                                  ...frameNotes,
                                  [f.id]: e.target.value,
                                })
                              }
                              className="mt-2 w-full border border-border rounded-lg bg-background p-3"
                            />
                          </label>
                          <button
                            className={secondary}
                            disabled={
                              busy ||
                              requesting ||
                              !f.complete ||
                              !frameNotes[f.id]?.trim() ||
                              g.manualRegenerations >=
                                g.limits.manualRegenerations
                            }
                            onClick={() =>
                              estimate(
                                "frame-regenerate",
                                frameNotes[f.id],
                                f.id,
                              )
                            }
                          >
                            Estimate this frame change
                          </button>
                          <details className="mt-4">
                            <summary className="cursor-pointer py-2">
                              All {f.attempts.length} attempts
                            </summary>
                            <div className="space-y-6">
                              {f.attempts.map((a) => (
                                <div key={a.id}>
                                  <ImageView image={a} run={run} />
                                  {a.review?.passed &&
                                    a.id !== f.selectedAttemptId && (
                                      <button
                                        className={secondary}
                                        disabled={busy}
                                        onClick={() =>
                                          onAction(
                                            "Restoring saved frame",
                                            () =>
                                              repairAction(
                                                run.id,
                                                `frames/${f.id}/restore`,
                                                {
                                                  attemptId: a.id,
                                                  expectedSelectedAttemptId:
                                                    f.selectedAttemptId,
                                                },
                                              ),
                                          )
                                        }
                                      >
                                        Restore frame {f.order + 1} attempt{" "}
                                        {a.attempt}
                                      </button>
                                    )}
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <p className="text-sm text-muted">
                Failed visual requirements must be resolved, or a previous
                passing attempt restored, before approval.
              </p>
              <button
                className={button}
                disabled={
                  busy ||
                  g.board.some((f) => {
                    const a = f.attempts.find(
                      (a) => a.id === f.selectedAttemptId,
                    );
                    return (
                      !f.complete ||
                      !a ||
                      a.intentAudit?.passed === false ||
                      a.review?.visibleChecks?.some((c) => !c.observed) ||
                      !!a.review?.criticalFailures?.length
                    );
                  }) ||
                  !!g.boardApprovedAt
                }
                onClick={() =>
                  onAction("Approving Storyboard", () =>
                    approveStoryboard(run.id),
                  )
                }
              >
                {g.boardApprovedAt
                  ? "Storyboard approved"
                  : "Approve Storyboard"}
              </button>
            </>
          )}
          {!!g?.archivedBoards.length && (
            <details className={box}>
              <summary className="cursor-pointer">
                Previous Storyboards ({g.archivedBoards.length}) — no longer
                active
              </summary>
              {g.archivedBoards.map((board, i) => (
                <div key={i} className="grid gap-5 sm:grid-cols-2 mt-4">
                  {board.map((f) => (
                    <div key={f.id}>
                      <h3>
                        Frame {f.order + 1} · {f.beatIds.join(", ")}
                      </h3>
                      {f.attempts.map((a) => (
                        <ImageView key={a.id} image={a} run={run} />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </details>
          )}
        </section>
      )}
      {g && (
        <section className={box}>
          <h2 className="text-lg font-semibold">Progress</h2>
          <p className="my-2 text-sm">
            {run.job?.finishedAt &&
              `Elapsed ${Math.round((Date.parse(run.job.finishedAt) - Date.parse(run.job.startedAt)) / 1000)}s · `}
            {run.job?.message}
          </p>
          <details>
            <summary className="cursor-pointer py-2 text-sm text-muted">
              Quality settings
            </summary>
            <p className="text-sm text-muted">
              Prompt threshold {g.limits.promptThreshold}, up to{" "}
              {g.limits.promptRewrites} rewrites. Frame threshold{" "}
              {g.limits.frameThreshold}, up to {g.limits.autoRegenerations}{" "}
              automatic replacements. Maximum {g.limits.maxFrames} total frames.
            </p>
          </details>
          {["failed", "interrupted"].includes(run.jobStatus) &&
            run.job &&
            ["key", "key-regenerate", "board", "frame-regenerate"].includes(
              run.job.kind,
            ) && (
              <button
                className={`${secondary} mt-3 mr-3`}
                disabled={requesting || busy}
                onClick={() =>
                  estimate(
                    run.job!.kind as ImageQuote["action"],
                    run.job!.note,
                    run.job!.frameId,
                    true,
                  )
                }
              >
                Estimate and confirm recovery
              </button>
            )}
          {run.jobStatus === "failed" && (
            <button
              className={`${secondary} mt-3`}
              onClick={() =>
                onAction("Resuming saved work", () => resumeRun(run.id))
              }
            >
              Retry from saved checkpoint
            </button>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer py-2">
              Saved activity history ({g.activities.length})
            </summary>
            <ol className="max-h-72 overflow-y-auto space-y-3 mt-3">
              {g.activities.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="text-muted">
                    {new Date(a.at).toLocaleTimeString()} · {a.state} ·{" "}
                    {a.origin}
                  </span>
                  <p className="break-words">{a.message}</p>
                </li>
              ))}
            </ol>
          </details>
          <h3 className="font-semibold mt-6 mb-3">
            Estimated costs, not provider invoices
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            {["story", "direction", "look", "storyboard"].map((s) => (
              <p key={s} className="capitalize">
                {s}:{" "}
                {money(
                  run.aiCallLog
                    .filter((c) => c.stage === s)
                    .reduce((n, c) => n + c.estimatedCostUsd, 0),
                )}
              </p>
            ))}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer py-2">
              Every AI call ({run.aiCallLog.length})
            </summary>
            {run.aiCallLog.map((c) => (
              <div
                key={c.id}
                className="border-t border-border py-3 text-sm break-words"
              >
                <p>
                  {c.stage} · {c.task ?? c.callType} · {c.model}
                </p>
                <p>
                  {c.outcome} · {c.origin ?? "user"} · request attempt{" "}
                  {c.attempt ?? 1} · {((c.durationMs ?? 0) / 1000).toFixed(1)}s
                </p>
                <p>
                  {c.inputTokens ?? "?"} input / {c.outputTokens ?? "?"} output
                  tokens · {c.imageCount ?? 0} images · estimate{" "}
                  {c.usageKnown || c.testMode
                    ? money(c.estimatedCostUsd)
                    : "unknown until usage is returned"}
                </p>
                {c.error && <p className="text-warning">{c.error}</p>}
              </div>
            ))}
          </details>
        </section>
      )}
    </div>
  );
}
