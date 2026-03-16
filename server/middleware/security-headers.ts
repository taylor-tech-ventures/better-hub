import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'security-headers' });

/** Allowed origins for CORS. Production uses the app domain; dev allows localhost. */
function getAllowedOrigins(env: Cloudflare.Env): string[] {
  const origins = ['https://gh-admin.com', 'https://www.gh-admin.com'];
  if ((env as Record<string, unknown>).ENVIRONMENT !== 'prod') {
    origins.push('http://localhost:8787', 'http://127.0.0.1:8787');
  }
  return origins;
}

/**
 * Build the Content-Security-Policy header value.
 *
 * In production, `script-src 'self'` blocks all inline scripts.
 * In development, Vite injects inline `<script>` tags for HMR and module
 * loading, so we must add `'unsafe-inline'` to `script-src` or the app
 * JavaScript won't execute at all.
 */
function buildCsp(env: Cloudflare.Env): string {
  const isProd = (env as Record<string, unknown>).ENVIRONMENT === 'prod';
  const scriptSrc = isProd ? "'self'" : "'self' 'unsafe-inline'";
  return `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' https://avatars.githubusercontent.com data:; font-src 'self'; connect-src 'self' https://api.github.com https://api.stripe.com wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
}

/** Security headers applied to all responses (without CSP — added per-request). */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(self)',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/** Handles CORS preflight requests. Returns a Response for OPTIONS, or null. */
export function handleCorsPreflightIfNeeded(
  request: Request,
  env: Cloudflare.Env,
): Response | null {
  if (request.method !== 'OPTIONS') return null;

  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env);

  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  logger.debug({ origin }, 'CORS preflight');

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      ...SECURITY_HEADERS,
      'Content-Security-Policy': buildCsp(env),
    },
  });
}

/** Applies security headers and CORS headers to an existing response. */
export function applySecurityHeaders(
  response: Response,
  request: Request,
  env: Cloudflare.Env,
): Response {
  // WebSocket upgrade responses (status 101) cannot be reconstructed —
  // the Response constructor only accepts status codes 200-599.
  if (response.status === 101 || response.webSocket) {
    return response;
  }

  const newHeaders = new Headers(response.headers);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newHeaders.set(key, value);
  }
  newHeaders.set('Content-Security-Policy', buildCsp(env));

  const origin = request.headers.get('Origin');
  if (origin) {
    const allowedOrigins = getAllowedOrigins(env);
    if (allowedOrigins.includes(origin)) {
      newHeaders.set('Access-Control-Allow-Origin', origin);
      newHeaders.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
