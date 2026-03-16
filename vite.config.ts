import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    cloudflare({
      inspectorPort: false,
      configPath: './wrangler.jsonc',
      persistState: {
        path: './.wrangler/state',
      },
      viteEnvironment: { name: 'ssr' },
    }),
    tanstackStart({
      router: {
        routesDirectory: 'routes',
        generatedRouteTree: 'routeTree.gen.ts',
      },
      srcDirectory: 'clients/web',
    }),
    react(),
  ],
  root: './',
  build: {
    outDir: './dist',
  },
  server: {
    port: 8787,
  },
  ssr: {
    optimizeDeps: {
      include: ['@modelcontextprotocol/sdk/server/mcp.js', 'ajv'],
    },
  },
});
