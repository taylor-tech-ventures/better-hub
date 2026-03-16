import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tsconfigPaths({
      configNames: [
        'tsconfig.server.json',
        'tsconfig.web.json',
        'tsconfig.json',
      ],
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', 'dist', '.git', 'e2e/**'],
    setupFiles: ['__tests__/setup.ts'],
  },
  resolve: {
    alias: [
      { find: '@/root', replacement: path.resolve(__dirname, './') },
      { find: '@/server', replacement: path.resolve(__dirname, './server') },
      { find: '@/web', replacement: path.resolve(__dirname, './clients/web') },
      { find: '@/mcp', replacement: path.resolve(__dirname, './clients/mcp') },
      {
        find: '@/shared',
        replacement: path.resolve(__dirname, './packages/shared'),
      },
      { find: '@', replacement: path.resolve(__dirname, './server') },
    ],
  },
});
