import * as p from "@clack/prompts";
import { runWizardFlow, type WizardOptions } from "./wizard/index.js";
import { runGithubReleaseFlow } from "./github-release.js";
import { t } from "../i18n/index.js";

export async function showMainMenu(wizardOptions: Partial<WizardOptions> = {}): Promise<void> {
  const action = await p.select({
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
    await runWizardFlow({
      dryRun: false,
      json: false,
      push: false,
      yes: false,
      ...wizardOptions,
    });
    return;
  }

  if (action === "github") {
    await runGithubReleaseFlow();
    p.outro(t().wizard.bye);
  }
}
