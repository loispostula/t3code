/**
 * Upstream drift for fork builds. A build stamped with `VITE_T3CODE_FORK=owner/repo:branch` asks
 * GitHub how many upstream commits its branch lacks, and hands the catch-up to an agent thread.
 */

export interface ForkBuild {
  readonly owner: string;
  readonly name: string;
  readonly branch: string;
}

export interface ForkUpstreamStatus {
  readonly behindBy: number;
  readonly compareUrl: string;
  readonly upstreamRepository: string;
  readonly upstreamBranch: string;
  readonly upstreamCloneUrl: string;
}

export function parseForkBuild(raw: string): ForkBuild | null {
  const match = /^([\w.-]+)\/([\w.-]+):(\S+)$/.exec(raw.trim());
  if (!match) return null;
  const [, owner, name, branch] = match as unknown as [string, string, string, string];
  return { owner, name, branch };
}

export const FORK_BUILD = parseForkBuild(import.meta.env.VITE_T3CODE_FORK ?? "");

interface GitHubRepository {
  readonly full_name: string;
  readonly clone_url: string;
  readonly default_branch: string;
  readonly owner: { readonly login: string };
  readonly name: string;
  readonly parent?: GitHubRepository;
}

async function getGitHubJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!response.ok) throw new Error(`GitHub ${path} answered ${response.status}.`);
  return (await response.json()) as T;
}

export async function fetchForkUpstreamStatus(
  fork: ForkBuild,
  signal: AbortSignal,
): Promise<ForkUpstreamStatus> {
  const repository = await getGitHubJson<GitHubRepository>(
    `repos/${fork.owner}/${fork.name}`,
    signal,
  );
  const upstream = repository.parent;
  if (!upstream) throw new Error(`${repository.full_name} is not a fork.`);
  // Compared from the fork's side, "ahead" counts upstream commits the branch has not replayed.
  const comparison = await getGitHubJson<{ readonly ahead_by: number; readonly html_url: string }>(
    `repos/${fork.owner}/${fork.name}/compare/${fork.branch}...${upstream.owner.login}:${upstream.name}:${upstream.default_branch}`,
    signal,
  );
  return {
    behindBy: comparison.ahead_by,
    compareUrl: comparison.html_url,
    upstreamRepository: upstream.full_name,
    upstreamBranch: upstream.default_branch,
    upstreamCloneUrl: upstream.clone_url,
  };
}

export function forkUpdatePrompt(fork: ForkBuild, upstream: ForkUpstreamStatus): string {
  return [
    `Bring \`${fork.branch}\` up to date with ${upstream.upstreamRepository} \`${upstream.upstreamBranch}\` (${upstream.behindBy} new upstream commits).`,
    "",
    `1. Make sure the working tree is clean, then switch to \`${fork.branch}\`.`,
    `2. \`git fetch ${upstream.upstreamCloneUrl} ${upstream.upstreamBranch}\`, then \`git rebase --autostash FETCH_HEAD\`. Rebase, never merge.`,
    "3. Resolve each conflict so upstream's behavior and our patch's intent both survive. If upstream already ships one of our patches, `git rebase --skip` it.",
    "4. `vp i`, then typecheck and test the packages whose files you resolved. Fix what fails.",
    `5. \`git push --force-with-lease\` \`${fork.branch}\` to the remote for ${fork.owner}/${fork.name}.`,
    "6. Report the new HEAD, which of our patches were dropped or changed, and anything you are unsure about.",
  ].join("\n");
}
