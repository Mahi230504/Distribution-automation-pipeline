import test from "node:test";
import assert from "node:assert/strict";
import { response } from "../src/fixtures.js";
import { parseResearch, matchesSupport } from "../src/story.js";

test("Grounded numbered prose retains statements and matches provider punctuation without fabricating attribution", () => {
  const reply = response({});
  reply.candidates![0].content!.parts![0].text = Array.from({length: 5}, (_, i) => `${i + 1}. Shoe feature ${i + 1} matters.`).join("\n");
  const facts = parseResearch(reply).facts;
  assert.equal(facts.length, 5);
  assert.equal(facts[0].text, "Shoe feature 1 matters.");
  assert.ok(matchesSupport("Shoe feature 1 matters", facts[0].text));
  assert.ok(!matchesSupport("Shoe feature 2 matters", facts[0].text));
  assert.ok(!matchesSupport("", facts[0].text));
  assert.ok(!matchesSupport("Shoe feature 1", facts[0].text));
});

test("Research parser still accepts JSON fixtures and rejects too few claims", () => {
  const data = {facts: Array.from({length:5}, (_,i)=>({text:`Fact ${i}`}))};
  assert.deepEqual(parseResearch(response(data)), data);
  const reply = response({});
  reply.candidates![0].content!.parts![0].text = "1. Only one claim.";
  assert.throws(()=>parseResearch(reply));
});
