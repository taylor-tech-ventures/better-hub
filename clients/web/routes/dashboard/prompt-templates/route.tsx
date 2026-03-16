import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/prompt-templates')({
  ssr: false,
  component: PromptTemplatesLayout,
});

function PromptTemplatesLayout() {
  return <Outlet />;
}
