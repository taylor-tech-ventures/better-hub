import type { Endpoints } from '@octokit/types';
import getOctokit from '@/server/data-access-layer/github/client';
import { getGitHubUserOrgs } from '@/server/data-access-layer/github/org/get-user-orgs';

type GetRepoParams = Endpoints['GET /repos/{owner}/{repo}']['parameters'];
type GetTeamParams =
  Endpoints['GET /orgs/{org}/teams/{team_slug}']['parameters'];
type GetUserParams = Endpoints['GET /users/{username}']['parameters'];
type GetBranchParams =
  Endpoints['GET /repos/{owner}/{repo}/branches/{branch}']['parameters'];
type GetTeamRepoAccessParams =
  Endpoints['GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}']['parameters'];

/**
 * Checks whether a GitHub entity (repo, team, user, branch, team-repo-access, or org) exists
 * by making the corresponding GitHub API request.
 * @param entity - The type of entity to check for existence.
 * @param parameters - The parameters required by the corresponding GitHub API endpoint.
 * @param accessToken - The GitHub OAuth access token for authentication.
 * @returns `true` if the entity exists and is accessible, `false` otherwise.
 */
export async function githubExistsRequest(
  entity: 'repo' | 'team' | 'user' | 'branch' | 'team-repo-access' | 'org',
  parameters:
    | GetRepoParams
    | GetTeamParams
    | GetUserParams
    | GetBranchParams
    | GetTeamRepoAccessParams
    | { org: string },
  accessToken: string,
): Promise<boolean> {
  try {
    const octokit = getOctokit(accessToken);
    let path: keyof Endpoints;
    switch (entity) {
      case 'repo':
        path = 'GET /repos/{owner}/{repo}';
        if ('owner' in parameters === false || 'repo' in parameters === false) {
          throw new Error(
            'Invalid parameters. Must include owner and repo to check if repo exists.',
          );
        }
        break;
      case 'team':
        path = 'GET /orgs/{org}/teams/{team_slug}';
        if (
          'org' in parameters === false ||
          'team_slug' in parameters === false
        ) {
          throw new Error(
            'Invalid parameters. Must include org and team_slug to check if team exists.',
          );
        }
        break;
      case 'user':
        path = 'GET /users/{username}';
        if ('username' in parameters === false) {
          throw new Error(
            'Invalid parameters. Must include username to check if a user exists.',
          );
        }
        break;
      case 'branch':
        path = 'GET /repos/{owner}/{repo}/branches/{branch}';
        if (
          'owner' in parameters === false ||
          'repo' in parameters === false ||
          'branch' in parameters === false
        ) {
          throw new Error(
            'Invalid parameters. Must include owner, repo, and branch to check if branch exists.',
          );
        }
        break;
      case 'team-repo-access':
        path = 'GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}';
        if (
          'org' in parameters === false ||
          'team_slug' in parameters === false ||
          'owner' in parameters === false ||
          'repo' in parameters === false
        ) {
          throw new Error(
            'Invalid parameters. Must include org, team_slug, owner, repo to check if team access for a repo exists.',
          );
        }
        break;
      case 'org':
        if ('org' in parameters === false) {
          throw new Error(
            'Invalid parameters. Must include org to check if organization exists.',
          );
        }
        return await githubOrgAccessCheck(
          (parameters as { org: string }).org,
          accessToken,
        );
      default:
        throw new Error('Invalid entity type');
    }
    await octokit.request(path, parameters);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Checks if the user has access to a specific organization
 * @param orgName - The organization name to check
 * @param accessToken - The user's access token
 * @returns Promise<boolean> - true if user has access to the org, false otherwise
 */
export async function githubOrgAccessCheck(
  orgName: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const result = await getGitHubUserOrgs({ accessToken });

    if (!result.success) {
      return false;
    }

    return result.data.some(
      (org) => org.login.toLowerCase() === orgName.toLowerCase(),
    );
  } catch (_error) {
    return false;
  }
}
