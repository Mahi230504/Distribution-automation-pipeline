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
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, HTMLMediaElement: dom.window.HTMLMediaElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, File: dom.window.File, Blob: dom.window.Blob }))
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
  const packBase={provenance:"test" as const,validationPolicyFingerprint:"policy"};
  return { id: "run", userId: "user", currentStage: "done", jobStatus: "completed", createdAt: now, updatedAt: now, runningCostUsd: 0, autopilot: false, brief: { topic: "Test", audience: "", platform: "youtube_shorts", aspectRatio: "9:16", durationSeconds: 15, targetVideoModel: "Veo", sourceLinks: [], notes: "", pastedScript: null }, sources: [], facts: [], script: null, directions: [], selectedDirectionId: null, directionNote: "", videoPrompt: null, frames: [], pack: null, aiCallLog: [], release: { schemaVersion: 1, revision: 5, approvalEpoch: 0, packVersions: [{ id: oldPackId, version: 1, origin: "generated", ...packBase, createdAt: now, createdBy: "user", changeSummary: "Generated", storyboardLineage: "lineage", content, validation: { valid: true, policyVersion: "test", blockers: [], warnings: [], checkedAt: now }, callIds: [] }, { id: packId, version: 2, origin: "edited", ...packBase, createdAt: now, createdBy: "user", changeSummary: "Edited", storyboardLineage: "lineage", content, validation: { valid: true, policyVersion: "test", blockers: [], warnings: [], checkedAt: now }, callIds: [] }], activePackVersionId: packId, mediaVersions: [{ id: mediaId, version: 1, assetId: "asset", storyboardLineage: "lineage", originalSafeFilename: "final.mp4", detectedMediaType: "video/mp4", byteSize: 10, sha256: "a".repeat(64), probe: { container: "mp4", videoCodec: "h264", audioCodecs: ["aac"], durationSeconds: 15, codedWidth: 720, codedHeight: 1280, displayWidth: 720, displayHeight: 1280, rotation: 0 }, validation: { valid: true, policyVersion: "test", blockers: [], warnings: [{code:"media-warning",message:"Review audio loudness."}], checkedAt: now }, createdAt: now, createdBy: "user" }], activeMediaVersionId: mediaId, selectedDestinations: ["youtube_shorts"], destinationRevision: 1, readiness: { valid: true, policyVersion: "test", blockers: [], warnings: [], checkedAt: now, releaseRevision: 5, storyboardLineage: "lineage", packVersionId: packId, mediaVersionId: mediaId, destinations: ["youtube_shorts"] }, approvals: [{ id: approvalId, version: 1, ownerId: "user", runId: "run", approvalEpoch: 0, storyboardLineage: "lineage", packVersionId: packId, packProvenance:"test",policyFingerprint:"policy",mediaVersionId: mediaId, mediaSha256: "a".repeat(64), destinations: ["youtube_shorts"], readinessFingerprint: "fingerprint", approvedAt: now, approvedBy: "user" }], activeApprovalId: approvalId, supersessions: [], packQuotes: [],packIntents:[] } } as Run;
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
  render(<PackPanel run={run} busy={false} standaloneSample={false} confirmDiscard={()=>true} onSave={async(value)=>{saved.push(value)}} onRestore={async(id)=>{restored.push(id)}} onContinue={async()=>{}} onUpdate={()=>{}}/>);
  fireEvent.change(screen.getByLabelText("YouTube title"), { target: { value: "Changed" } }); assert.equal(saved.length, 0);
  fireEvent.click(screen.getByRole("button", { name: "Save as new Pack version" })); await waitFor(() => assert.equal(saved[0].platforms.youtube_shorts.title, "Changed"));
  fireEvent.click(screen.getByText(/Pack history/)); fireEvent.click(screen.getByRole("button", { name: "Restore as new version" })); await waitFor(() => assert.equal(restored.length, 1));
});

test("a failed ambiguous Pack exposes an explicit new-intent recovery action",async()=>{const {default:PackPanel}=await import("../components/panels/PackPanel");const run=releaseRun();run.currentStage="pack";run.release!.packVersions=[];delete run.release!.activePackVersionId;run.jobStatus="failed";run.job={id:"failed-pack-job",kind:"pack",status:"failed",checkpoint:"provider-call",startedAt:"2026-10-02T00:00:00.000Z",finishedAt:"2026-10-02T00:01:00.000Z",message:"The Pack provider result is unknown.",ambiguousProviderResult:true};let generated=0;render(<PackPanel run={run} busy={false} standaloneSample={false} onGenerate={async()=>{generated++;}} onSave={async()=>{}} onRestore={async()=>{}} onContinue={async()=>{}} onUpdate={()=>{}}/>);assert.match(screen.getByRole("alert").textContent??"",/will not be repeated/i);fireEvent.click(screen.getByRole("button",{name:"Request a new Pack estimate"}));await waitFor(()=>assert.equal(generated,1));});

test("destination changes are saved and Reopen requires explicit confirmation", async () => {
  const { default: ApprovePanel } = await import("../components/panels/ApprovePanel"); const run = releaseRun(); let saved: string[] = [], reopened = 0, updated = 0,confirmed=false;
  render(<ApprovePanel run={run} busy={false} onApprove={async()=>{}} onReopen={async()=>{reopened++}} onEdit={async()=>{}} onUpdate={()=>{updated++}} confirmReopen={()=>confirmed} saveDestinationsRequest={async(_id,destinations)=>{saved=destinations;return run}}/>);
  fireEvent.click(screen.getByLabelText("Instagram Reels")); fireEvent.click(screen.getByRole("button", { name: "Save destinations" })); await waitFor(() => assert.deepEqual(saved,["youtube_shorts","instagram_reels"])); assert.equal(updated,1);
  fireEvent.click(screen.getByRole("button", { name: "Reopen for review" }));assert.equal(reopened,0);confirmed=true;fireEvent.click(screen.getByRole("button", { name: "Reopen for review" }));await waitFor(() => assert.equal(reopened,1));
});

test("dirty Pack draft survives a stale save and warns before restore, then server refresh remounts it",async()=>{
  const {default:PackPanel}=await import("../components/panels/PackPanel");const run=releaseRun();run.currentStage="pack";let saves=0,restores=0,allow=false;
  const props={run,busy:false,standaloneSample:false,onSave:async()=>{saves++;throw new Error("The Pack changed. Refresh and apply your edit again.");},onRestore:async()=>{restores++;},onContinue:async()=>{},onUpdate:()=>{},confirmDiscard:()=>allow};
  const view=render(<PackPanel key={run.release!.activePackVersionId} {...props}/>);const title=screen.getByLabelText("YouTube title") as HTMLInputElement;fireEvent.change(title,{target:{value:"Unsaved draft"}});fireEvent.click(screen.getByRole("button",{name:"Save as new Pack version"}));await screen.findByText(/The Pack changed/);assert.equal(saves,1);assert.equal((screen.getByLabelText("YouTube title") as HTMLInputElement).value,"Unsaved draft");fireEvent.click(screen.getByText(/Pack history/));fireEvent.click(screen.getByRole("button",{name:"Restore as new version"}));assert.equal(restores,0);allow=true;fireEvent.click(screen.getByRole("button",{name:"Restore as new version"}));await waitFor(()=>assert.equal(restores,1));assert.equal((screen.getByLabelText("YouTube title") as HTMLInputElement).value,"Unsaved draft");
  const refreshed=releaseRun();refreshed.currentStage="pack";refreshed.release!.activePackVersionId=refreshed.release!.packVersions[0].id;view.rerender(<PackPanel key={refreshed.release!.activePackVersionId} {...props} run={refreshed}/>);assert.equal((screen.getByLabelText("YouTube title") as HTMLInputElement).value,"Title");
});

test("unsaved destinations block approval until saved",async()=>{const {default:ApprovePanel}=await import("../components/panels/ApprovePanel");const run=releaseRun();delete run.release!.activeApprovalId;run.currentStage="approve";let approvals=0;render(<ApprovePanel run={run} busy={false} onApprove={async()=>{approvals++;}} onReopen={async()=>{}} onEdit={async()=>{}} onUpdate={()=>{}}/>);const approve=screen.getByRole("button",{name:"Approve this release candidate"}) as HTMLButtonElement;assert.equal(approve.disabled,false);fireEvent.click(screen.getByLabelText("Instagram Reels"));assert.equal(approve.disabled,true);assert.match(screen.getByRole("alert").textContent??"",/save destination changes/i);fireEvent.click(approve);assert.equal(approvals,0);});

test("video upload shows progress/error and authenticated download uses the protected path",async()=>{const {default:PackPanel}=await import("../components/panels/PackPanel");const run=releaseRun();run.currentStage="pack";let rejectUpload!:(error:Error)=>void,downloadPath="",downloaded="";const uploadRequest=async(_run:Run,_file:File,progress:(value:number)=>void)=>{progress(50);return await new Promise<Run>((_resolve,reject)=>{rejectUpload=reject;});};render(<PackPanel run={run} busy={false} standaloneSample={false} onSave={async()=>{}} onRestore={async()=>{}} onContinue={async()=>{}} onUpdate={()=>{}} uploadRequest={uploadRequest} downloadRequest={async(path)=>{downloadPath=path;return new Blob(["video"]);}} download={(_blob,name)=>{downloaded=name;}}/>);const input=screen.getByLabelText("Select finished MP4") as HTMLInputElement;fireEvent.change(input,{target:{files:[new File(["video"],"video.mp4",{type:"video/mp4"})]}});await screen.findByText("Uploading 50%");rejectUpload(new Error("Upload rejected"));await screen.findByText("Upload rejected");assert.match(screen.getByText(/Warning: Review audio loudness/).textContent??"",/Warning/);fireEvent.click(screen.getByRole("button",{name:"Download current authenticated MP4"}));await waitFor(()=>assert.match(downloadPath,/final-media\/.*download=1/));assert.equal(downloaded,"final.mp4");});
