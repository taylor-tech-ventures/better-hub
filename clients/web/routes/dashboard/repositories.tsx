import { createFileRoute, redirect } from '@tanstack/react-router';
import { GitBranchIcon } from 'lucide-react';

export const Route = createFileRoute('/dashboard/repositories')({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: '/' });
  },
  component: RepositoriesPage,
});

function RepositoriesPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
      <GitBranchIcon className="size-12 stroke-1" />
      <div className="text-center">
        <h2 className="text-lg font-medium">Repositories</h2>
        <p className="text-sm">Coming soon</p>
      </div>
    </div>
  );
}
