import { Octokit } from "@octokit/rest";
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device";
import * as p from "@clack/prompts";
import color from "picocolors";
import { t } from "../i18n/index.js";

const GITHUB_CLI_CLIENT_ID = "178c6fc778ccc68e1d6a";

export async function interactiveGithubLogin(): Promise<string | null> {
  const auth = createOAuthDeviceAuth({
    clientType: "oauth-app",
    clientId: GITHUB_CLI_CLIENT_ID,
    scopes: ["repo"],
    onVerification(verification) {
      p.log.info(t().execute.githubDeviceLoginInstructions(color.cyan(verification.verification_uri), color.bold(verification.user_code)));
    },
  });

  try {
    const result = await auth({ type: "oauth" });
    p.log.success(t().execute.githubDeviceLoginSuccess);
    return result.token;
  } catch (error) {
    return null;
  }
}

export async function createGithubRelease(opts: {
  token: string;
  owner: string;
  repo: string;
  tagName: string;
  body: string;
  prerelease: boolean;
}): Promise<string> {
  const octokit = new Octokit({ auth: opts.token });
  const { data } = await octokit.repos.createRelease({
    owner: opts.owner,
    repo: opts.repo,
    tag_name: opts.tagName,
    name: opts.tagName,
    body: opts.body,
    prerelease: opts.prerelease,
  });
  return data.html_url;
}
