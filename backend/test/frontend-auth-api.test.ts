import test from "node:test";
import assert from "node:assert/strict";

test("sign-out removes API access and a restored session sends only its current token", async () => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.example.test";
  process.env.NEXT_PUBLIC_AUTH_MODE = "supabase";
  const seen: Array<string | null> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    seen.push(new Headers(init?.headers).get("authorization"));
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const api = await import("../../frontend/lib/api.js");
    api.setAccessTokenProvider(async () => "user-a-token");
    await api.listRuns();
    api.setAccessTokenProvider(async () => null);
    await assert.rejects(api.listRuns(), /session has ended/i);
    api.setAccessTokenProvider(async () => "restored-user-b-token");
    await api.listRuns();
    assert.deepEqual(seen, ["Bearer user-a-token", "Bearer restored-user-b-token"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
