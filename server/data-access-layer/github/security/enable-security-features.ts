import { RequestError as OctokitError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';

export type SecurityFeatureResult = {
  repo: string;
  feature: string;
  success: boolean;
  error?: string;
};

type SecurityFeatures = {
  dependabot_alerts?: boolean;
  dependabot_updates?: boolean;
  secret_scanning?: boolean;
  secret_scanning_push_protection?: boolean;
};

/**
 * Enables security features on one or more repositories.
 */
export async function enableSecurityFeatures(params: {
  accessToken: string | undefined;
  owner: string;
  repos: string[];
  features: SecurityFeatures;
}): Promise<GitHubResult<SecurityFeatureResult[]>> {
  const { accessToken, owner, repos, features } = params;

  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      'GitHub access token is required. Please re-authenticate.',
    );
  }

  try {
    const octokit = getOctokit(accessToken);
    const results: SecurityFeatureResult[] = [];

    for (const repo of repos) {
      if (features.dependabot_alerts) {
        try {
          await octokit.request(
            'PUT /repos/{owner}/{repo}/vulnerability-alerts',
            { owner, repo },
          );
          results.push({ repo, feature: 'dependabot_alerts', success: true });
        } catch (err) {
          results.push({
            repo,
            feature: 'dependabot_alerts',
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (features.dependabot_updates) {
        try {
          await octokit.request(
            'PUT /repos/{owner}/{repo}/automated-security-fixes',
            { owner, repo },
          );
          results.push({ repo, feature: 'dependabot_updates', success: true });
        } catch (err) {
          results.push({
            repo,
            feature: 'dependabot_updates',
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (
        features.secret_scanning ||
        features.secret_scanning_push_protection
      ) {
        try {
          const securityUpdate: Record<string, unknown> = {};
          if (features.secret_scanning) {
            securityUpdate.security_and_analysis = {
              ...((securityUpdate.security_and_analysis as Record<
                string,
                unknown
              >) ?? {}),
              secret_scanning: { status: 'enabled' },
            };
          }
          if (features.secret_scanning_push_protection) {
            securityUpdate.security_and_analysis = {
              ...((securityUpdate.security_and_analysis as Record<
                string,
                unknown
              >) ?? {}),
              secret_scanning_push_protection: { status: 'enabled' },
            };
          }
          await octokit.request('PATCH /repos/{owner}/{repo}', {
            owner,
            repo,
            ...securityUpdate,
          });
          if (features.secret_scanning) {
            results.push({ repo, feature: 'secret_scanning', success: true });
          }
          if (features.secret_scanning_push_protection) {
            results.push({
              repo,
              feature: 'secret_scanning_push_protection',
              success: true,
            });
          }
        } catch (err) {
          if (features.secret_scanning) {
            results.push({
              repo,
              feature: 'secret_scanning',
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          if (features.secret_scanning_push_protection) {
            results.push({
              repo,
              feature: 'secret_scanning_push_protection',
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    return ok(results);
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error enabling security features: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error enabling security features: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
