import { test } from "node:test";
import assert from "node:assert";
import { setRunMode, resetRunMode } from "./mode.js";
import { promptTagMessages } from "../commands/wizard/steps/tag-messages.js";
import type { ReleaseState } from "../core/checkpoint.js";

function releaseState(name: string, tagMessage: string): ReleaseState {
  return {
    pkg: { dir: `/repo/packages/${name}`, manifest: { name, version: "1.0.0" } },
    commits: [],
    bump: "minor",
    newVersion: "1.1.0",
    tagMessage,
  } as unknown as ReleaseState;
}

test("promptTagMessages in non-interactive mode keeps the auto-generated messages (#71)", async (t) => {
  setRunMode({ interactive: false, json: false });
  t.after(resetRunMode);

  const state = new Map<string, ReleaseState>([
    ["pkg-a", releaseState("pkg-a", "pkg-a@1.1.0\n\n- feat: a")],
    ["pkg-b", releaseState("pkg-b", "pkg-b@1.1.0\n\n- fix: b")],
  ]);

  const result = await promptTagMessages(state);

  assert.strictEqual(result, true);
  assert.strictEqual(state.get("pkg-a")!.tagMessage, "pkg-a@1.1.0\n\n- feat: a");
  assert.strictEqual(state.get("pkg-b")!.tagMessage, "pkg-b@1.1.0\n\n- fix: b");
});
