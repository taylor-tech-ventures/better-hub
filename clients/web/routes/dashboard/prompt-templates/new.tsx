import { createFileRoute } from '@tanstack/react-router';
import { TemplateBuilder } from '@/web/components/prompt-templates/template-builder';

export const Route = createFileRoute('/dashboard/prompt-templates/new')({
  component: NewTemplatePage,
});

function NewTemplatePage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <TemplateBuilder />
      </div>
    </div>
  );
}
