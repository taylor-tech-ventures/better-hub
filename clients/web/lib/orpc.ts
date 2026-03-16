import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { DurableIteratorLinkPlugin } from '@orpc/experimental-durable-iterator/client';
import type { RouterClient } from '@orpc/server';
import type { router } from '@/server/orpc/router';

/**
 * oRPC client for calling server procedures from the browser.
 * Uses RPCLink over HTTP — only call this client-side (e.g. in event handlers).
 * For server-side data loading, use TanStack Start server functions directly.
 */
export const orpcClient: RouterClient<typeof router> = createORPCClient(
  new RPCLink({
    url: () => new URL('/api/orpc', window.location.origin),
    plugins: [
      new DurableIteratorLinkPlugin({
        url: () => {
          const url = new URL(
            '/api/orpc/durable-iterator',
            window.location.origin,
          );
          url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          return url;
        },
      }),
    ],
  }),
);
