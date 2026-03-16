import { RPCLink } from '@orpc/client/fetch';
import { createORPCClient } from '@orpc/client';
import type { router } from '../../../server/orpc/router.js';
import { getApiUrl, getAuthHeaders } from './auth.js';

type Router = typeof router;

function createCliOrpcClient() {
  const link = new RPCLink({
    url: () => `${getApiUrl()}/api/orpc`,
    headers: () => getAuthHeaders(),
  });

  return createORPCClient<Router>(link);
}

/** Lazily-initialized oRPC client for the CLI. */
let _client: ReturnType<typeof createCliOrpcClient> | undefined;

export function getOrpcClient() {
  if (!_client) {
    _client = createCliOrpcClient();
  }
  return _client;
}

/** Reset the client (e.g. after auth change). */
export function resetOrpcClient(): void {
  _client = undefined;
}
