import { Command } from "commander";
import * as p from "@clack/prompts";
import color from "picocolors";
import { loadConfig } from "../config.js";
import { listTagsWithMeta, getTagAnnotation, getGitHubRemoteInfo } from "../git/index.js";
import type { TagInfo } from "../git/index.js";
import { createGithubRelease, interactiveGithubLogin } from "../integrations/github.js";
import { resolveGithubToken } from "../core/token.js";
import { setLocale, t, type Locale } from "../i18n/index.js";
import { wizardSelect, SELECT_BACK } from "./wizard/wizard-select.js";

const DONE_SENTINEL = "__done__";

function groupTagsByPackage(tags: TagInfo[]): Map<string, TagInfo[]> {
  const groups = new Map<string, TagInfo[]>();
  const NAME_VERSION_RE = /^(.+)@(\d.*)$/;
  for (const tag of tags) {
    const m = NAME_VERSION_RE.exec(tag.name);
    const key = m ? m[1] : "(otros)";
    const bucket = groups.get(key) ?? [];
    bucket.push(tag);
    groups.set(key, bucket);
  }
  return groups;
}

export async function runGithubReleaseFlow(config?: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
  const cfg = config ?? await loadConfig();

  let token = await resolveGithubToken(cfg.github?.token);
  if (!token) {
    p.log.warn(t().githubRelease.noToken);
    const login = await p.confirm({
      message: t().execute.githubDeviceLoginPrompt,
      initialValue: true,
    });
    if (!p.isCancel(login) && login) {
      token = await interactiveGithubLogin();
    }

    if (!token) {
      return;
    }
  }

  const ghInfo = await getGitHubRemoteInfo();
  if (!ghInfo) {
    p.log.warn(t().githubRelease.noRemote);
    return;
  }

  const spinner = p.spinner();
  spinner.start(t().githubRelease.loadingTags);
  const allTags = await listTagsWithMeta();
  spinner.stop(t().githubRelease.tagsLoaded(allTags.length));

  if (allTags.length === 0) {
    p.log.warn(t().githubRelease.noTags);
    return;
  }

  const groups = groupTagsByPackage(allTags);
  const packageNames = [...groups.keys()];

  const selectedTags: string[] = [];
  const selectedByPackage = new Map<string, string>();

  while (true) {
    const packageOptions = packageNames.map((pkg) => {
      const hasSelection = selectedByPackage.has(pkg);
      return {
        value: pkg,
        label: hasSelection
          ? `${color.green("✓")} ${pkg}  ${color.dim(`(${t().githubRelease.alreadySelected})`)}`
          : pkg,
      };
    });

    const doneLabel = t().githubRelease.doneSelectingTags;
    const doneOption = {
      value: DONE_SENTINEL,
      label: selectedTags.length === 0
        ? color.dim(doneLabel)
        : color.green(doneLabel),
      hint: selectedTags.length === 0 ? t().githubRelease.noTagsSelectedYet : undefined,
    };

    const pkgResult = await wizardSelect<string>(
      t().githubRelease.selectPackage,
      [...packageOptions, doneOption],
    );

    if (p.isCancel(pkgResult)) {
      p.cancel(t().githubRelease.cancelled);
      return;
    }

    if (pkgResult === SELECT_BACK) continue;

    const chosenPkg = pkgResult as string;

    if (chosenPkg === DONE_SENTINEL) {
      if (selectedTags.length === 0) {
        p.log.warn(t().githubRelease.noTagsSelectedYet);
        continue;
      }
      break;
    }

    const tagsForPkg = groups.get(chosenPkg) ?? [];
    const versionOptions = tagsForPkg.map((tag) => {
      const versionMatch = /^.+@(.+)$/.exec(tag.name);
      const version = versionMatch ? versionMatch[1] : tag.name;
      const meta = [tag.date, tag.tagger].filter(Boolean).join(" · ");
      return {
        value: tag.name,
        label: version,
        hint: meta || undefined,
      };
    });

    const versionResult = await wizardSelect<string>(
      t().githubRelease.selectTagVersion(chosenPkg),
      versionOptions,
      undefined,
      t().scan.goBack,
    );

    if (p.isCancel(versionResult)) {
      p.cancel(t().githubRelease.cancelled);
      return;
    }

    if (versionResult === SELECT_BACK) continue;

    const chosenTag = versionResult as string;
    const previousTag = selectedByPackage.get(chosenPkg);
    if (previousTag) {
      const idx = selectedTags.indexOf(previousTag);
      if (idx !== -1) selectedTags.splice(idx, 1);
    }
    selectedByPackage.set(chosenPkg, chosenTag);
    selectedTags.push(chosenTag);
  }

  const ghSpinner = p.spinner();
  ghSpinner.start(t().githubRelease.creating);

  const urls: string[] = [];
  for (const tag of selectedTags) {
    try {
      const body = await getTagAnnotation(tag);
      const url = await createGithubRelease({
        token,
        owner: ghInfo.owner,
        repo: ghInfo.repo,
        tagName: tag,
        body,
        prerelease: cfg.github?.prerelease ?? false,
      });
      urls.push(url);
    } catch (e: any) {
      p.log.warn(t().githubRelease.failed(tag, e.message));
    }
  }

  ghSpinner.stop(t().githubRelease.done(urls.length));
  for (const url of urls) {
    p.log.info(`  ${color.cyan(url)}`);
  }
}

export const githubReleaseCommand = new Command("github-release")
  .description("Create GitHub Releases from existing local git tags")
  .option("--lang <lang>", "Interface language: es | en", "es")
  .action(async (options: { lang: string }) => {
    if (["es", "en"].includes(options.lang)) {
      setLocale(options.lang as Locale);
    }

    console.clear();
    p.intro(`${color.bgCyan(color.black(" tagman "))} GitHub Releaser`);

    try {
      await runGithubReleaseFlow();
      p.outro(color.green(t().wizard.bye));
    } catch (err: any) {
      p.log.error(err.message);
      p.outro(t().wizard.error);
    }
  });
