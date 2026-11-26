import * as p from "@clack/prompts";
import * as ui from "../ui/prompts.js";
import { runWizardFlow, type WizardOptions } from "./wizard/index.js";
import { runGithubReleaseFlow } from "./github-release.js";
import { t } from "../i18n/index.js";
import type { ReleaseOutcome } from "../ui/run.js";

/** Errors propagate to the caller's `runCommand`, which sets the exit code (#71). */
export async function showMainMenu(wizardOptions: Partial<WizardOptions> = {}): Promise<ReleaseOutcome | void> {
  const action = await ui.select({
    message: t().menu.question,
    options: [
      {
        value: "release",
        label: t().menu.createRelease,
        hint: t().menu.createReleaseHint,
      },
      {
        value: "github",
        label: t().menu.githubRelease,
        hint: t().menu.githubReleaseHint,
      },
      {
        value: "exit",
        label: t().menu.exit,
      },
    ],
  });

  if (p.isCancel(action) || action === "exit") {
    p.outro(t().wizard.bye);
    return;
  }

  if (action === "release") {
    return runWizardFlow({
      dryRun: false,
      json: false,
      push: false,
      yes: false,
      ...wizardOptions,
    });
  }

  if (action === "github") {
    await runGithubReleaseFlow();
    p.outro(t().wizard.bye);
  }
}
