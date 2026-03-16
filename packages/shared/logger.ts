import pino from 'pino';

/**
 * Creates a structured JSON logger using pino.
 *
 * Uses pino's browser-compatible mode (no native bindings) so it works in
 * Cloudflare Workers. Output is structured JSON compatible with `wrangler tail`
 * and Cloudflare Logpush.
 *
 * @param context - Optional base fields included in every log line (e.g. userId, module).
 */
export function createLogger(context?: Record<string, unknown>): pino.Logger {
  return pino({
    level: 'debug',
    base: context ?? {},
    timestamp: pino.stdTimeFunctions.isoTime,
    browser: {
      write: {
        fatal: (o: object) => console.error(JSON.stringify(o)),
        error: (o: object) => console.error(JSON.stringify(o)),
        warn: (o: object) => console.warn(JSON.stringify(o)),
        info: (o: object) => console.log(JSON.stringify(o)),
        debug: (o: object) => console.log(JSON.stringify(o)),
        trace: (o: object) => console.log(JSON.stringify(o)),
      },
    },
  });
}
