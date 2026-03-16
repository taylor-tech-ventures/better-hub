import { createRouter } from '@tanstack/react-router';
import { routeTree } from '@/web/routeTree.gen';

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    context: { session: null },
  });

  return router;
}
