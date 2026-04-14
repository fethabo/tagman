import { Command } from "commander";
import * as p from "@clack/prompts";
import color from "picocolors";
import { loadConfig } from "../config.js";
import { listAllTags, getTagAnnotation, getGitHubRemoteInfo } from "../git/index.js";
import { createGithubRelease } from "../integrations/github.js";
import { setLocale, t, type Locale } from "../i18n/index.js";

export async function runGithubReleaseFlow(config?: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
  const cfg = config ?? await loadConfig();

  const token = cfg.github?.token ?? process.env.GITHUB_TOKEN;
  if (!token) {
    p.log.warn(t().githubRelease.noToken);
    return;
  }

  const ghInfo = await getGitHubRemoteInfo();
  if (!ghInfo) {
    p.log.warn(t().githubRelease.noRemote);
    return;
  }

  const spinner = p.spinner();
  spinner.start(t().githubRelease.loadingTags);
  const allTags = await listAllTags();
  spinner.stop(t().githubRelease.tagsLoaded(allTags.length));

  if (allTags.length === 0) {
    p.log.warn(t().githubRelease.noTags);
    return;
  }

  const selected = await p.multiselect({
    message: t().githubRelease.selectTags,
    options: allTags.map(tag => ({ value: tag, label: tag })),
    required: true,
  });

  if (p.isCancel(selected)) {
    p.cancel(t().githubRelease.cancelled);
    return;
  }

  const tags = selected as string[];

  const ghSpinner = p.spinner();
  ghSpinner.start(t().githubRelease.creating);

  const urls: string[] = [];
  for (const tag of tags) {
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
