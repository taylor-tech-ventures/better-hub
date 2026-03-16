import { stripeClient } from '@better-auth/stripe/client';
import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { cloudflareClient } from 'better-auth-cloudflare/client';

export const authClient = createAuthClient({
  plugins: [
    cloudflareClient(),
    adminClient(),
    inferAdditionalFields({
      user: {
        login: {
          type: 'string',
        },
      },
    }),
    stripeClient({
      subscription: true,
    }),
  ],
});

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  role?: string | null;
  login: string;
}

export interface Session {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: User;
}
