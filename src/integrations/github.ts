import { Octokit } from "@octokit/rest";

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
