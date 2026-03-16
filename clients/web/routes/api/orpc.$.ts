import { env } from 'cloudflare:workers';
import { DurableIteratorHandlerPlugin } from '@orpc/experimental-durable-iterator';
import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { createFileRoute } from '@tanstack/react-router';
import { router } from '@/server/orpc/router';

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error('[oRPC]', error);
    }),
  ],
  plugins: [new DurableIteratorHandlerPlugin()],
});

export const Route = createFileRoute('/api/orpc/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { response } = await handler.handle(request, {
          prefix: '/api/orpc',
          context: { headers: request.headers, env },
        });
        return response ?? new Response('Not Found', { status: 404 });
      },
    },
  },
});
