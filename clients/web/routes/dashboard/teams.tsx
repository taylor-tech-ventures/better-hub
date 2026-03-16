import { createFileRoute, redirect } from '@tanstack/react-router';
import { UsersIcon } from 'lucide-react';

export const Route = createFileRoute('/dashboard/teams')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/' });
  },
  component: TeamsPage,
});

function TeamsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
      <UsersIcon className="size-12 stroke-1" />
      <div className="text-center">
        <h2 className="text-lg font-medium">Teams</h2>
        <p className="text-sm">Coming soon</p>
      </div>
    </div>
  );
}
