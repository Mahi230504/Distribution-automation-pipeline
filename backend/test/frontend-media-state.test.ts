import test from "node:test";
import assert from "node:assert/strict";
import { openFetchedProtectedAsset, stateForProtectedSource } from "../../frontend/lib/protected-media.js";

test("a new protected-image source clears the previous error and URL", () => {
  const failed = {
    source: "/api/images/missing",
    url: "",
    error: true,
  };
  assert.deepEqual(
    stateForProtectedSource(failed, "/api/images/valid"),
    { source: "/api/images/valid", url: "", error: false },
  );
  const loaded = {
    source: "/api/images/valid",
    url: "blob:valid-image",
    error: false,
  };
  assert.equal(
    stateForProtectedSource(loaded, "/api/images/valid").url,
    "blob:valid-image",
  );
});

test("an archived asset reserves its tab before fetch, detaches it and navigates after fetch", async () => {
  const events: string[] = [];
  let release!: (value: string) => void;
  const fetched = new Promise<string>((resolve) => { release = resolve; });
  const tab = { id: "preview" };
  const opening = openFetchedProtectedAsset({
    openBlank: () => { events.push("open"); return tab; },
    detachOpener: () => { events.push("detach"); },
    prepare: () => { events.push("prepare"); },
    fetch: () => { events.push("fetch"); return fetched; },
    createUrl: () => { events.push("url"); return "blob:archive"; },
    navigate: (_tab, url) => { events.push(`navigate:${url}`); },
    close: () => { events.push("close"); },
    download: () => { events.push("download"); },
    revokeLater: () => { events.push("revoke-later"); },
  });
  assert.deepEqual(events, ["open", "detach", "prepare", "fetch"]);
  release("asset");
  assert.equal(await opening, "preview");
  assert.deepEqual(events, ["open", "detach", "prepare", "fetch", "url", "navigate:blob:archive", "revoke-later"]);
});

test("archived asset failure closes its reserved tab and popup blocking downloads", async () => {
  let closed = false;
  await assert.rejects(
    openFetchedProtectedAsset({
      openBlank: () => ({ id: "preview" }),
      detachOpener: () => {},
      prepare: () => {},
      fetch: async () => { throw new Error("denied"); },
      createUrl: () => "blob:unused",
      navigate: () => {},
      close: () => { closed = true; },
      download: () => {},
      revokeLater: () => {},
    }),
    /denied/,
  );
  assert.equal(closed, true);

  let downloaded = "";
  const result = await openFetchedProtectedAsset({
    openBlank: () => null,
    detachOpener: () => {},
    prepare: () => {},
    fetch: async () => "asset",
    createUrl: () => "blob:fallback",
    navigate: () => {},
    close: () => {},
    download: (url) => { downloaded = url; },
    revokeLater: () => {},
  });
  assert.equal(result, "download");
  assert.equal(downloaded, "blob:fallback");
});
