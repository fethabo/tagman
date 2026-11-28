import { test, after } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Tag lookups against a real git repo (#74). `src/git/index.ts` binds its
 * simple-git instance to the cwd at import time, so the module is imported
 * dynamically after chdir-ing into the temp repo. node:test runs each test file
 * in its own process, so the chdir does not leak into other suites.
 */
const originalCwd = process.cwd();
const repo = fs.mkdtempSync(path.join(os.tmpdir(), "tagman-tags-"));
process.chdir(repo);

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(repo, { recursive: true, force: true });
});

function sh(...args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf-8" }).trim();
}

function commit(message: string): string {
  fs.appendFileSync(path.join(repo, "file.txt"), `${message}\n`);
  sh("add", ".");
  sh("commit", "-q", "-m", message);
  return sh("rev-parse", "HEAD");
}

function tag(name: string): void {
  sh("tag", "-a", name, "-m", name);
}

sh("init", "-q");
sh("config", "user.email", "test@example.com");
sh("config", "user.name", "test");
sh("config", "commit.gpgsign", "false");
sh("config", "tag.gpgsign", "false");
sh("config", "core.autocrlf", "false");

const gitApi = await import("./index.js");

test("tag lookup per tagName scheme", async (t) => {
  // History: A ── B ── C ── D (each step adds tags, asserted as it goes)
  commit("feat: a");
  tag("pkg@0.11.0");          // legacy full-scheme tag (repo migrated to version-only)
  tag("other@1.2.0-beta.3");

  const b = commit("feat: b");

  await t.test("version-only keeps the baseline of a legacy pkg@ tag", async () => {
    assert.strictEqual(await gitApi.getLastTagForPackage("pkg", "version-only"), "pkg@0.11.0");
    const unreleased = await gitApi.getUnreleasedCommitsForPath(".", "pkg", "version-only");
    assert.deepStrictEqual(unreleased.map(c => c.hash), [b]);
  });

  tag("0.12.0");
  tag("other@1.2.0");
  const c = commit("fix: c");
  tag("2fa-setup");           // unrelated tag starting with a digit
  const d = commit("fix: d");

  await t.test("version-only resolves bare tags by semver over legacy ones", async () => {
    assert.strictEqual(await gitApi.getLastTagForPackage("pkg", "version-only"), "0.12.0");
    assert.strictEqual(await gitApi.getLastStableTagForPackage("pkg", "version-only"), "0.12.0");
  });

  await t.test("version-only lists only commits after the last release", async () => {
    const byPath = await gitApi.getUnreleasedCommitsForPath(".", "pkg", "version-only");
    assert.deepStrictEqual(byPath.map(x => x.hash), [d, c]);
    const repoWide = await gitApi.getUnreleasedRepoCommits("pkg", "version-only");
    assert.deepStrictEqual(repoWide.map(x => x.hash), [d, c]);
  });

  await t.test("a non-semver tag never hides unreleased commits", async () => {
    const hashes = (await gitApi.getUnreleasedCommitsForPath(".", "pkg", "version-only")).map(x => x.hash);
    assert.ok(hashes.includes(c), "commit tagged 2fa-setup must still be unreleased");
  });

  await t.test("full ignores bare version tags", async () => {
    assert.strictEqual(await gitApi.getLastTagForPackage("pkg", "full"), "pkg@0.11.0");
    const unreleased = await gitApi.getUnreleasedCommitsForPath(".", "pkg", "full");
    assert.deepStrictEqual(unreleased.map(x => x.hash), [d, c, b]);
  });

  await t.test("full keeps semver order with pre-releases (regression #62)", async () => {
    assert.strictEqual(await gitApi.getLastTagForPackage("other", "full"), "other@1.2.0");
    assert.strictEqual(await gitApi.getLastStableTagForPackage("other", "full"), "other@1.2.0");
  });

  await t.test("version-only does not read another package's tags", async () => {
    // `other@*` tags exist on A and B; only pkg's tags may count.
    assert.notStrictEqual(await gitApi.getLastTagForPackage("pkg", "version-only"), "other@1.2.0");
  });
});
