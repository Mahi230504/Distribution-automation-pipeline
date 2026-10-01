import test, { afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import type { ReleasePackContent, Run } from "../lib/types";

let render: typeof import("@testing-library/react")["render"];
let fireEvent: typeof import("@testing-library/react")["fireEvent"];
let screen: typeof import("@testing-library/react")["screen"];
let waitFor: typeof import("@testing-library/react")["waitFor"];
let cleanup: typeof import("@testing-library/react")["cleanup"];

before(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, HTMLMediaElement: dom.window.HTMLMediaElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent }))
    Object.defineProperty(globalThis, name, { configurable: true, value });
  ({ render, fireEvent, screen, waitFor, cleanup } = await import("@testing-library/react"));
});
afterEach(() => cleanup());

const content: ReleasePackContent = {
  finalPrompt: "Prompt", negativePrompt: "Avoid errors", thumbnailText: "Release",
  platforms: {
    youtube_shorts: { title: "Title", description: "Description", tags: ["tag"], accessibilityNotes: "Captions", postingNotes: "Review" },
    instagram_reels: { caption: "Caption", hashtags: ["#tag"], altText: "Alt", postingNotes: "Review" },
    linkedin: { title: "Title", commentary: "Commentary", hashtags: ["#tag"], accessibilityNotes: "Captions", postingNotes: "Review" },
  },
};
function releaseRun(): Run {
  const now = "2026-10-01T00:00:00.000Z", packId = "11111111-1111-4111-8111-111111111111", oldPackId = "22222222-2222-4222-8222-222222222222", mediaId = "33333333-3333-4333-8333-333333333333", approvalId = "44444444-4444-4444-8444-444444444444";
  return { id: "run", userId: "user", currentStage: "done", jobStatus: "completed", createdAt: now, updatedAt: now, runningCostUsd: 0, autopilot: false, brief: { topic: "Test", audience: "", platform: "youtube_shorts", aspectRatio: "9:16", durationSeconds: 15, targetVideoModel: "Veo", sourceLinks: [], notes: "", pastedScript: null }, sources: [], facts: [], script: null, directions: [], selectedDirectionId: null, directionNote: "", videoPrompt: null, frames: [], pack: null, aiCallLog: [], release: { schemaVersion: 1, revision: 5, approvalEpoch: 0, packVersions: [{ id: oldPackId, version: 1, origin: "generated", createdAt: now, createdBy: "user", changeSummary: "Generated", storyboardLineage: "lineage", content, validation: { valid: true, policyVersion: "test", blockers: [], warnings: [], checkedAt: now }, callIds: [] }, { id: packId, version: 2, origin: "edited", createdAt: now, createdBy: "user", changeSummary: "Edited", storyboardLineage: "lineage", content, validation: { valid: true, policyVersion: "test", blockers: [], warnings: [], checkedAt: now }, callIds: [] }], activePackVersionId: packId, mediaVersions: [{ id: mediaId, version: 1, assetId: "asset", storyboardLineage: "lineage", originalSafeFilename: "final.mp4", detectedMediaType: "video/mp4", byteSize: 10, sha256: "a".repeat(64), probe: { container: "mp4", videoCodec: "h264", audioCodecs: ["aac"], durationSeconds: 15, codedWidth: 720, codedHeight: 1280, displayWidth: 720, displayHeight: 1280, rotation: 0 }, validation: { valid: true, policyVersion: "test", blockers: [], warnings: [], checkedAt: now }, createdAt: now, createdBy: "user" }], activeMediaVersionId: mediaId, selectedDestinations: ["youtube_shorts"], destinationRevision: 1, readiness: { valid: true, policyVersion: "test", blockers: [], warnings: [], checkedAt: now, releaseRevision: 5, storyboardLineage: "lineage", packVersionId: packId, mediaVersionId: mediaId, destinations: ["youtube_shorts"] }, approvals: [{ id: approvalId, version: 1, ownerId: "user", runId: "run", approvalEpoch: 0, storyboardLineage: "lineage", packVersionId: packId, mediaVersionId: mediaId, mediaSha256: "a".repeat(64), destinations: ["youtube_shorts"], readinessFingerprint: "fingerprint", approvedAt: now, approvedBy: "user" }], activeApprovalId: approvalId, supersessions: [], packQuotes: [] } } as Run;
}

test("ProtectedVideo clears a failed source and revokes the previous object URL", async () => {
  const { default: ProtectedVideo } = await import("../components/ProtectedVideo");
  const revoked: string[] = []; let number = 0;
  Object.defineProperty(globalThis.URL, "createObjectURL", { configurable: true, value: () => `blob:${++number}` });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", { configurable: true, value: (url: string) => revoked.push(url) });
  const fetcher = async (path: string) => { if (path === "/bad") throw new Error("denied"); return new Blob([path]); };
  const view = render(<ProtectedVideo src="/bad" fetcher={fetcher}/>);
  await screen.findByRole("alert");
  view.rerender(<ProtectedVideo src="/valid" fetcher={fetcher}/>);
  await waitFor(() => assert.equal(view.container.querySelector("video")?.getAttribute("src"), "blob:1"));
  view.rerender(<ProtectedVideo src="/new" fetcher={fetcher}/>);
  await waitFor(() => assert.deepEqual(revoked, ["blob:1"]));
});

test("Pack edits require explicit Save and history restore is an explicit action", async () => {
  const { default: PackPanel } = await import("../components/panels/PackPanel"); const run = releaseRun(); run.currentStage = "pack"; delete run.release!.activeMediaVersionId; run.release!.mediaVersions = [];
  const saved: ReleasePackContent[] = [], restored: string[] = [];
  render(<PackPanel run={run} busy={false} onSave={async(value)=>{saved.push(value)}} onRestore={async(id)=>{restored.push(id)}} onContinue={async()=>{}} onUpdate={()=>{}}/>);
  fireEvent.change(screen.getByLabelText("YouTube title"), { target: { value: "Changed" } }); assert.equal(saved.length, 0);
  fireEvent.click(screen.getByRole("button", { name: "Save as new Pack version" })); await waitFor(() => assert.equal(saved[0].platforms.youtube_shorts.title, "Changed"));
  fireEvent.click(screen.getByText(/Pack history/)); fireEvent.click(screen.getByRole("button", { name: "Restore as new version" })); await waitFor(() => assert.equal(restored.length, 1));
});

test("destination changes are saved and Reopen stays an explicit action", async () => {
  const { default: ApprovePanel } = await import("../components/panels/ApprovePanel"); const run = releaseRun(); let saved: string[] = [], reopened = 0, updated = 0;
  render(<ApprovePanel run={run} busy={false} onApprove={async()=>{}} onReopen={async()=>{reopened++}} onUpdate={()=>{updated++}} saveDestinationsRequest={async(_id,destinations)=>{saved=destinations;return run}}/>);
  fireEvent.click(screen.getByLabelText("Instagram Reels")); fireEvent.click(screen.getByRole("button", { name: "Save destinations" })); await waitFor(() => assert.deepEqual(saved,["youtube_shorts","instagram_reels"])); assert.equal(updated,1);
  fireEvent.click(screen.getByRole("button", { name: "Reopen for editing" })); await waitFor(() => assert.equal(reopened,1));
});
