import { test } from "node:test";
import assert from "node:assert";
import { setRunMode, resetRunMode, HeadlessError, ReportedError } from "./mode.js";
import { runCommand, type ReleaseOutcome } from "./run.js";

/** Run `runCommand` capturing stdout; returns the last written chunk and the exit code. */
async function capture(flow: () => Promise<ReleaseOutcome | void>) {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    await runCommand(flow);
  } finally {
    process.stdout.write = originalWrite;
  }
  const exitCode = process.exitCode;
  process.exitCode = 0;
  return { last: chunks.at(-1) ?? "", exitCode };
}

test("runCommand maps outcomes and errors to exit codes and JSON (#71)", async (t) => {
  setRunMode({ interactive: false, json: true });
  t.after(() => {
    resetRunMode();
    process.exitCode = 0;
  });

  await t.test("success emits the outcome with exit code 0", async () => {
    const outcome: ReleaseOutcome = {
      success: true,
      packages: [{ name: "pkg-a", previousVersion: "1.0.0", newVersion: "1.1.0", tag: "pkg-a@1.1.0" }],
    };
    const { last, exitCode } = await capture(async () => outcome);
    assert.deepStrictEqual(JSON.parse(last), outcome);
    assert.ok(!exitCode);
  });

  await t.test("no-commits is not an error", async () => {
    const { last, exitCode } = await capture(async () => ({ success: false, reason: "no-commits", message: "nothing" }));
    assert.strictEqual(JSON.parse(last).reason, "no-commits");
    assert.ok(!exitCode);
  });

  await t.test("a HeadlessError keeps its reason, exit code and extra fields", async () => {
    const { last, exitCode } = await capture(async () => {
      throw new HeadlessError("packages-required", "need --packages", 1, { candidates: ["a", "b"] });
    });
    assert.deepStrictEqual(JSON.parse(last), {
      success: false,
      reason: "packages-required",
      message: "need --packages",
      candidates: ["a", "b"],
    });
    assert.strictEqual(exitCode, 1);
  });

  await t.test("interaction-required exits with code 2", async () => {
    const { last, exitCode } = await capture(async () => {
      throw new HeadlessError("interaction-required", "needs an answer", 2, { prompt: "Push?" });
    });
    assert.strictEqual(JSON.parse(last).reason, "interaction-required");
    assert.strictEqual(exitCode, 2);
  });

  await t.test("a generic error becomes reason 'error' with exit code 1", async () => {
    const { last, exitCode } = await capture(async () => {
      throw new Error("boom");
    });
    assert.deepStrictEqual(JSON.parse(last), { success: false, reason: "error", message: "boom" });
    assert.strictEqual(exitCode, 1);
  });

  await t.test("an already-reported failure still exits non-zero", async () => {
    const { last, exitCode } = await capture(async () => {
      throw new ReportedError("tag failed");
    });
    assert.strictEqual(JSON.parse(last).reason, "error");
    assert.strictEqual(exitCode, 1);
  });
});
