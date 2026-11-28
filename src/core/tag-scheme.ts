import semver from "semver";
import type { TagmanConfig } from "../config.js";

/**
 * Single source of truth for release tag names (#74). Writing (tag creation,
 * rollback, headers) and reading (last tag, unreleased commits, changelog
 * compare link) must agree on the scheme, or `version-only` repos never find
 * their previous release.
 */
export type TagScheme = TagmanConfig["tagName"];

/** Tag name for a release: `pkg@1.2.0` (full) or `1.2.0` (version-only). */
export function formatTag(pkg: string, version: string, tagName: TagScheme): string {
  return tagName === "version-only" ? version : `${pkg}@${version}`;
}

/**
 * `git tag -l` globs that may hold release tags of the package. version-only
 * also reads `pkg@*` so a repo that switched from `full` keeps its baseline.
 * Globs over-match (`[0-9]*` lists `2fa-setup`): filter with parseTagVersion.
 */
export function tagGlobs(pkg: string, tagName: TagScheme): string[] {
  return tagName === "version-only" ? ["[0-9]*", `${pkg}@*`] : [`${pkg}@*`];
}

/**
 * Version a tag stands for, or null when it is not a release tag of the package
 * under this scheme. Non-semver tags must return null: they would otherwise hide
 * unreleased commits when used as `^tag` exclusions.
 */
export function parseTagVersion(tag: string, pkg: string, tagName: TagScheme): string | null {
  const prefix = `${pkg}@`;
  if (tag.startsWith(prefix)) {
    const version = tag.slice(prefix.length);
    return semver.valid(version) !== null ? version : null;
  }
  if (tagName === "version-only") {
    // Exact match only: semver.valid("v1.0.0") normalises to "1.0.0", but tagman
    // never writes a `v` prefix, so such tags are not ours.
    return semver.valid(tag) === tag ? tag : null;
  }
  return null;
}
