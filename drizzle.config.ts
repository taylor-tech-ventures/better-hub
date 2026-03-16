import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

function getLocalD1DB() {
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Getting local D1 DB');
  try {
    const basePath = path.resolve('.wrangler/state/v3/d1');
    const dbFile = fs
      .readdirSync(basePath, { encoding: 'utf-8', recursive: true })
      .find((f) => f.endsWith('.sqlite'));

    if (!dbFile) {
      throw new Error(`.sqlite file not found in ${basePath}`);
    }

    console.log(`Using local D1 DB file: ${dbFile}`);

    const url = path.resolve(basePath, dbFile);
    return url;
  } catch (err) {
    console.log(`Error  ${err}`);
  }
}

config({
  path: '.dev.vars',
});

export default defineConfig({
  schema: './server/db/schemas',
  out: './server/db/migrations',
  dialect: 'sqlite',
  ...(process.env.NODE_ENV === 'production'
    ? {
        driver: 'd1-http',
        dbCredentials: {
          accountId: process.env.CLOUDFLARE_D1_ACCOUNT_ID,
          databaseId: process.env.CLOUDFLARE_DATABASE_ID,
          token: process.env.CLOUDFLARE_D1_API_TOKEN,
        },
      }
    : {
        dbCredentials: {
          url: getLocalD1DB(),
        },
      }),
});
