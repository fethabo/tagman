import { test } from "node:test";
import assert from "node:assert";
import { suggestBump } from "./commits.js";

test("suggestBump", async (t) => {
  await t.test("should return 'patch' for empty commit list", () => {
    assert.strictEqual(suggestBump([]), "patch");
  });

  await t.test("should return 'patch' for non-feat non-breaking commits", () => {
    const commits = [
      "fix: minor bug fix",
      "docs: update readme",
      "chore: update dependencies"
    ];
    assert.strictEqual(suggestBump(commits), "patch");
  });

  await t.test("should return 'minor' if at least one feat commit is present", () => {
    const commits = [
      "fix: minor bug fix",
      "feat: add new feature",
      "chore: update dependencies"
    ];
    assert.strictEqual(suggestBump(commits), "minor");
  });

  await t.test("should return 'major' if BREAKING CHANGE is in the message", () => {
    const commits = [
      "feat: add new feature\n\nBREAKING CHANGE: this is a breaking change",
      "fix: minor bug fix"
    ];
    assert.strictEqual(suggestBump(commits), "major");
  });

  await t.test("should return 'major' if !: is used", () => {
    const commits = [
      "feat!: add new feature with breaking change",
      "fix: minor bug fix"
    ];
    assert.strictEqual(suggestBump(commits), "major");
  });

  await t.test("should return 'major' even if feat commits are also present", () => {
    const commits = [
      "feat: add new feature",
      "feat!: breaking feature"
    ];
    assert.strictEqual(suggestBump(commits), "major");
  });

  await t.test("should return 'major' if BREAKING CHANGE is in the header", () => {
    const commits = [
      "fix: BREAKING CHANGE: something broke"
    ];
    assert.strictEqual(suggestBump(commits), "major");
  });
});
