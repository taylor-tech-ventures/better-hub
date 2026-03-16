import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { TerminalIcon } from 'lucide-react';
import { authClient } from '@/server/auth/client';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/web/components/ui/avatar';
import { Button } from '@/web/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { session } = Route.useRouteContext();
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.invalidate();
  };

  const handleSignIn = () => {
    authClient.signIn.social({
      provider: 'github-app',
      callbackURL: '/dashboard/chat',
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center space-y-3">
          <div className="flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground">
            <TerminalIcon className="size-6" />
          </div>
          <div>
            <CardTitle className="text-2xl">GH Admin</CardTitle>
            <CardDescription className="mt-1">
              GitHub Organization Administration
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {session ? (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Avatar className="size-9">
                  <AvatarImage
                    src={session.user.image ?? undefined}
                    alt={session.user.name}
                  />
                  <AvatarFallback>
                    {session.user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.user.email}
                  </p>
                </div>
              </div>
              <Button asChild className="w-full">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button className="w-full" onClick={handleSignIn}>
                Sign in with GitHub
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By signing in, you agree to our{' '}
                <Link
                  to="/terms-of-service"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  to="/privacy-policy"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
