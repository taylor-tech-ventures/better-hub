import { Octokit as OctokitCore } from '@octokit/core';
import { enterpriseCloud } from '@octokit/plugin-enterprise-cloud';
import { paginateGraphQL } from '@octokit/plugin-paginate-graphql';
import { paginateRest } from '@octokit/plugin-paginate-rest';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { retry } from '@octokit/plugin-retry';

export type {
  PageInfoBackward,
  PageInfoForward,
} from '@octokit/plugin-paginate-graphql';
export { RequestError } from '@octokit/request-error';

const Octokit = OctokitCore.plugin(
  enterpriseCloud,
  restEndpointMethods,
  paginateRest,
  paginateGraphQL,
  retry,
);
export type Octokit = InstanceType<typeof Octokit>;

export default function getOctokit(accessToken: string): Octokit {
  if (!accessToken) throw new Error('GitHub access token is required');
  return new Octokit({
    auth: accessToken,
    userAgent: 'gh-admin.com AI Agent',
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
    // Retry up to 3 times on 5xx and network errors with exponential backoff.
    // 4xx errors (400, 401, 403, 404, 422, 429, 451) are NOT retried by default:
    // they indicate client-side issues, not transient failures. Exception: 429
    // (rate-limited) is retried after the server-specified Retry-After delay.
    retry: { retries: 3 },
  });
}
