import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  rewriteDependencyRange,
  updateConsumerDependencies,
  restoreConsumerDependencies,
  buildCompareLink,
} from "./updater.js";

test("buildCompareLink (#74)", async (t) => {
  const base = "https://github.com/owner/repo";

  await t.test("version-only compares bare version tags", () => {
    assert.strictEqual(
      buildCompareLink(base, "pkg", "0.11.0", "0.12.0", "version-only"),
      `${base}/compare/0.11.0...0.12.0`,
    );
  });

  await t.test("full compares pkg@ tags", () => {
    assert.strictEqual(
      buildCompareLink(base, "pkg", "1.3.0", "1.4.0", "full"),
      `${base}/compare/pkg@1.3.0...pkg@1.4.0`,
    );
  });

  await t.test("without a remote it returns the bare range", () => {
    assert.strictEqual(buildCompareLink("", "pkg", "0.11.0", "0.12.0", "version-only"), "0.11.0...0.12.0");
  });
});

test("rewriteDependencyRange", async (t) => {
  const cases: Array<[string, string, string | null]> = [
    // workspace without version → untouched
    ["workspace:*", "1.3.0", null],
    ["workspace:^", "1.3.0", null],
    ["workspace:~", "1.3.0", null],
    // workspace with explicit version → keep protocol + operator
    ["workspace:^1.2.3", "1.3.0", "workspace:^1.3.0"],
    ["workspace:~1.2.3", "1.2.4", "workspace:~1.2.4"],
    ["workspace:1.2.3", "1.2.4", "workspace:1.2.4"],
    // plain semver → keep operator
    ["^1.2.3", "1.3.0", "^1.3.0"],
    ["~1.2.3", "1.2.4", "~1.2.4"],
    ["1.2.3", "2.0.0", "2.0.0"],
    ["^1.0.0", "1.1.0-rc.0", "^1.1.0-rc.0"],
    // other forms → untouched
    ["catalog:", "1.3.0", null],
    ["catalog:default", "1.3.0", null],
    ["npm:other@^1.0.0", "1.3.0", null],
    ["file:../ui", "1.3.0", null],
    ["link:../ui", "1.3.0", null],
    ["github:owner/repo#v1.0.0", "1.3.0", null],
    [">=1.0.0 <2.0.0", "1.3.0", null],
    ["1.x", "1.3.0", null],
    ["*", "1.3.0", null],
    ["latest", "1.3.0", null],
  ];

  for (const [current, newVersion, expected] of cases) {
    await t.test(`${current} → ${expected ?? "(untouched)"}`, () => {
      assert.strictEqual(rewriteDependencyRange(current, newVersion), expected);
    });
  }
});

async function withConsumer(manifest: object, fn: (dir: string, file: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tagman-updater-"));
  const file = path.join(dir, "package.json");
  // Non-default formatting (4 spaces) makes an unwanted rewrite detectable.
  await fs.writeFile(file, JSON.stringify(manifest, null, 4), "utf-8");
  try {
    await fn(dir, file);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("updateConsumerDependencies", async (t) => {
  await t.test("leaves a manifest with only workspace:* byte-identical", async () => {
    await withConsumer(
      {
        name: "@repo/app",
        version: "1.0.0",
        dependencies: { "@repo/ui": "workspace:*" },
        peerDependencies: { "@repo/ui": "workspace:^" },
      },
      async (dir, file) => {
        const before = await fs.readFile(file, "utf-8");
        await updateConsumerDependencies(dir, "@repo/ui", "1.0.2");
        assert.strictEqual(await fs.readFile(file, "utf-8"), before);
      },
    );
  });

  await t.test("keeps the operator of each field", async () => {
    await withConsumer(
      {
        name: "@repo/app",
        version: "1.0.0",
        dependencies: { "@repo/ui": "~1.2.3", other: "^9.0.0" },
        devDependencies: { "@repo/ui": "workspace:^1.2.3" },
      },
      async (dir, file) => {
        await updateConsumerDependencies(dir, "@repo/ui", "1.2.4");
        const pkg = JSON.parse(await fs.readFile(file, "utf-8"));
        assert.strictEqual(pkg.dependencies["@repo/ui"], "~1.2.4");
        assert.strictEqual(pkg.dependencies.other, "^9.0.0");
        assert.strictEqual(pkg.devDependencies["@repo/ui"], "workspace:^1.2.4");
      },
    );
  });
});

test("restoreConsumerDependencies", async (t) => {
  await t.test("restores the exact original reference, not ^previousVersion", async () => {
    const original = {
      name: "@repo/app",
      version: "1.0.0",
      dependencies: { "@repo/ui": "^1.0.0" },
      devDependencies: { "@repo/ui": "workspace:*" },
    };
    await withConsumer(original, async (dir, file) => {
      await updateConsumerDependencies(dir, "@repo/ui", "1.3.0");
      let pkg = JSON.parse(await fs.readFile(file, "utf-8"));
      assert.strictEqual(pkg.dependencies["@repo/ui"], "^1.3.0");

      await restoreConsumerDependencies(dir, "@repo/ui", original);
      pkg = JSON.parse(await fs.readFile(file, "utf-8"));
      assert.strictEqual(pkg.dependencies["@repo/ui"], "^1.0.0");
      assert.strictEqual(pkg.devDependencies["@repo/ui"], "workspace:*");
    });
  });
});
