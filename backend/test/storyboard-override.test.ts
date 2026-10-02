import test from "node:test";
import assert from "node:assert/strict";
import { assertStoryboardReviewComplete, storyboardReviewWarningFrameIds } from "../src/generation.js";
import { approvedRun } from "./fixtures.js";

test("a completed Storyboard may be explicitly approved with preserved review warnings",()=>{const run=approvedRun(),g=run.generation!,frame=g.board[0],selected=frame.attempts.find(attempt=>attempt.id===frame.selectedAttemptId)!;frame.isKey=false;selected.intentAudit={passed:false,reason:"Direction is ambiguous.",mode:"live"};selected.review={...selected.review!,passed:false,visibleChecks:[{requirement:"Descending",observed:false,evidence:"Direction is ambiguous."}]};assert.deepEqual(storyboardReviewWarningFrameIds(g),[frame.id]);assert.throws(()=>assertStoryboardReviewComplete(g,false),/explicit review override/);assert.deepEqual(assertStoryboardReviewComplete(g,true),[frame.id]);assert.equal(selected.intentAudit.passed,false);assert.equal(selected.review.visibleChecks[0].observed,false);});

test("review override never bypasses missing selected attempts or missing reviews",()=>{const run=approvedRun(),g=run.generation!,frame=g.board[0];frame.isKey=false;delete frame.selectedAttemptId;assert.throws(()=>assertStoryboardReviewComplete(g,true),/Finish the Storyboard review/);frame.selectedAttemptId=frame.attempts[0].id;delete frame.attempts[0].review;assert.throws(()=>assertStoryboardReviewComplete(g,true),/Finish the Storyboard review/);});
