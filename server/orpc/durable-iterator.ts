import { upgradeDurableIteratorRequest } from '@orpc/experimental-durable-iterator/durable-object';

export const DURABLE_ITERATOR_PATH = '/api/orpc/durable-iterator';

export function isDurableIteratorRequest(url: URL): boolean {
  return url.pathname === DURABLE_ITERATOR_PATH;
}

export function upgradeGitHubAgentEventsRequest(
  request: Request,
  env: Pick<Cloudflare.Env, 'AUTH_SECRET' | 'GitHubAgentEvents'>,
): Promise<Response> {
  return upgradeDurableIteratorRequest(request, {
    namespace: env.GitHubAgentEvents,
    signingKey: env.AUTH_SECRET,
  });
}
