import { test } from "node:test";
import assert from "node:assert";
import { formatTag, tagGlobs, parseTagVersion } from "./tag-scheme.js";

test("formatTag", async (t) => {
  await t.test("full → pkg@version", () => {
    assert.strictEqual(formatTag("@scope/pkg", "1.4.0", "full"), "@scope/pkg@1.4.0");
  });
  await t.test("version-only → version", () => {
    assert.strictEqual(formatTag("@scope/pkg", "0.12.0", "version-only"), "0.12.0");
  });
});

test("tagGlobs", async (t) => {
  await t.test("full lists only pkg@*", () => {
    assert.deepStrictEqual(tagGlobs("pkg", "full"), ["pkg@*"]);
  });
  await t.test("version-only lists bare versions and legacy pkg@*", () => {
    assert.deepStrictEqual(tagGlobs("pkg", "version-only"), ["[0-9]*", "pkg@*"]);
  });
});

test("parseTagVersion", async (t) => {
  const cases: Array<[string, "full" | "version-only", string | null]> = [
    // full: only pkg@<semver>
    ["pkg@1.2.0", "full", "1.2.0"],
    ["pkg@1.2.0-beta.3", "full", "1.2.0-beta.3"],
    ["pkg@latest", "full", null],
    ["1.2.0", "full", null],
    ["other@1.2.0", "full", null],
    // version-only: bare semver
    ["0.11.0", "version-only", "0.11.0"],
    ["1.0.0-rc.1", "version-only", "1.0.0-rc.1"],
    ["2fa-setup", "version-only", null],
    ["1.0", "version-only", null],
    ["v1.0.0", "version-only", null],
    // version-only: legacy full-scheme tags of this package
    ["pkg@0.11.0", "version-only", "0.11.0"],
    ["pkg@latest", "version-only", null],
    ["other@0.11.0", "version-only", null],
  ];

  for (const [tag, scheme, expected] of cases) {
    await t.test(`${scheme}: ${tag} → ${expected ?? "null"}`, () => {
      assert.strictEqual(parseTagVersion(tag, "pkg", scheme), expected);
    });
  }

  await t.test("scoped package names keep their leading @", () => {
    assert.strictEqual(parseTagVersion("@scope/pkg@2.0.0", "@scope/pkg", "full"), "2.0.0");
  });
});
