import { test } from "node:test";
import assert from "node:assert";
import { dirtyTreeGate, behindRemoteGate, pendingCheckpointGate, type GateContext } from "./gates.js";

const base: GateContext = { interactive: false, allowDirty: false, allowBehind: false, requireRemoteSync: false };

test("dirtyTreeGate", async (t) => {
  await t.test("headless without --allow-dirty fails", () => {
    assert.strictEqual(dirtyTreeGate(base), "fail");
  });
  await t.test("headless with --allow-dirty continues", () => {
    assert.strictEqual(dirtyTreeGate({ ...base, allowDirty: true }), "continue");
  });
  await t.test("interactive asks", () => {
    assert.strictEqual(dirtyTreeGate({ ...base, interactive: true }), "ask");
  });
});

test("behindRemoteGate", async (t) => {
  await t.test("headless without --allow-behind fails", () => {
    assert.strictEqual(behindRemoteGate(base), "fail");
  });
  await t.test("headless with --allow-behind continues", () => {
    assert.strictEqual(behindRemoteGate({ ...base, allowBehind: true }), "continue");
  });
  await t.test("requireRemoteSync wins over --allow-behind", () => {
    assert.strictEqual(behindRemoteGate({ ...base, allowBehind: true, requireRemoteSync: true }), "fail");
  });
  await t.test("requireRemoteSync fails interactively too (unchanged behavior)", () => {
    assert.strictEqual(behindRemoteGate({ ...base, interactive: true, requireRemoteSync: true }), "fail");
  });
  await t.test("interactive asks", () => {
    assert.strictEqual(behindRemoteGate({ ...base, interactive: true }), "ask");
  });
});

test("pendingCheckpointGate", async (t) => {
  await t.test("headless fails, never resumes or rolls back on its own", () => {
    assert.strictEqual(pendingCheckpointGate({ interactive: false }), "fail");
  });
  await t.test("interactive asks", () => {
    assert.strictEqual(pendingCheckpointGate({ interactive: true }), "ask");
  });
});
