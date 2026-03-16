import { genericOAuth } from 'better-auth/plugins';
import fetchGitHubUser from '@/server/data-access-layer/github/fetch-github-user';

export function createGithubOAuth(clientId: string, clientSecret: string) {
  return genericOAuth({
    config: [
      {
        providerId: 'github-app',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        clientId,
        clientSecret,
        // scopes: ['user:email', 'read:user'],
        pkce: true, // Enable PKCE for better security
        accessType: 'offline', // Request refresh tokens
        overrideUserInfo: true,
        async getUserInfo(tokens) {
          if (tokens.accessToken === undefined) {
            throw new Error('No GitHub user access token available');
          }

          const user = await fetchGitHubUser(tokens.accessToken);

          if (!user.email) {
            throw new Error('No email found on GitHub user profile');
          }

          return {
            id: user.id.toString(),
            email: user.email,
            emailVerified: true,
            name: user.name ?? user.login,
            createdAt: new Date(user.created_at),
            updatedAt: new Date(user.updated_at),
            image: user.avatar_url,
            login: user.login,
          };
        },
      },
    ],
  });
}
