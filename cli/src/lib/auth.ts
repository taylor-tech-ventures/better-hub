import Conf from 'conf';

interface StoredSession {
  token: string;
  expiresAt: number;
  userId: string;
  username: string;
}

const config = new Conf<{ session?: StoredSession; apiUrl?: string }>({
  projectName: 'gh-admin',
  schema: {
    session: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        expiresAt: { type: 'number' },
        userId: { type: 'string' },
        username: { type: 'string' },
      },
      required: ['token', 'expiresAt', 'userId', 'username'],
    },
    apiUrl: {
      type: 'string',
    },
  },
});

export function getStoredSession(): StoredSession | undefined {
  const session = config.get('session');
  if (!session) return undefined;

  // Check expiry
  if (Date.now() > session.expiresAt) {
    config.delete('session');
    return undefined;
  }

  return session;
}

export function storeSession(session: StoredSession): void {
  config.set('session', session);
}

export function clearSession(): void {
  config.delete('session');
}

export function ensureAuthenticated(): StoredSession {
  const session = getStoredSession();
  if (!session) {
    throw new Error(
      'Not authenticated. Run `gh-admin auth login` to sign in.',
    );
  }
  return session;
}

export function getAuthHeaders(): Record<string, string> {
  const session = getStoredSession();
  if (!session) return {};

  return {
    Authorization: `Bearer ${session.token}`,
  };
}

export function getApiUrl(): string {
  return (
    process.env.GH_ADMIN_API_URL ??
    config.get('apiUrl') ??
    'https://gh-admin.com'
  );
}

export function setApiUrl(url: string): void {
  config.set('apiUrl', url);
}

export function getConfigPath(): string {
  return config.path;
}

export { config };
