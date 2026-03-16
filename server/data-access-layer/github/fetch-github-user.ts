import type { Endpoints as GitHubAPIEndpointTypes } from '@octokit/types';
export type GitHubUser =
  GitHubAPIEndpointTypes['GET /user']['response']['data'];

import { createLogger } from '@/shared/logger';
import fetchGitHubUserEmail from './fetch-github-user-email';

const logger = createLogger({ module: 'fetch-github-user' });

export default async function fetchGitHubUser(
  access_token: string,
): Promise<GitHubUser> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'gh-admin-app',
      },
      method: 'GET',
    });
    if (!response.ok || response.status !== 200) {
      const text = await response.text();
      throw new Error(
        `GitHub API responded with status ${response.status}\n ${text}`,
      );
    }
    const userInfo = (await response.json()) as GitHubUser;
    if (userInfo.email === null) {
      try {
        userInfo.email = await fetchGitHubUserEmail(access_token);
      } catch (err) {
        logger.warn(
          { err, user: userInfo.login },
          'failed to fetch user email from GitHub emails endpoint',
        );
      }
    }
    return userInfo;
  } catch (error) {
    throw new Error(`Failed to fetch user info from GitHub: ${error}`);
  }
}
