import { test } from "node:test";
import assert from "node:assert/strict";
import { cachedHealth } from "../src/health-cache.js";
test("Health metadata requests coalesce and expire; failures are refreshed promptly", async () => {
  let time = 0,
    calls = 0,
    healthy = true;
  const get = cachedHealth(
    async () => {
      calls++;
      return { healthy };
    },
    () => time,
  );
  await Promise.all([get(), get(), get()]);
  assert.equal(calls, 1);
  time = 299999;
  await get();
  assert.equal(calls, 1);
  time = 300000;
  healthy = false;
  assert.equal((await get()).healthy, false);
  assert.equal(calls, 2);
  time += 9999;
  await get();
  assert.equal(calls, 2);
  time++;
  healthy = true;
  assert.equal((await get()).healthy, true);
  assert.equal(calls, 3);
});
test("A rejected health request is not cached as healthy", async () => {
  let calls = 0;
  const get = cachedHealth(async () => {
    if (++calls === 1) throw new Error("unreachable");
    return { healthy: true };
  });
  await assert.rejects(get(), /unreachable/);
  assert.equal((await get()).healthy, true);
});
