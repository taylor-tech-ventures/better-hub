import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { TemplateBuilder } from '@/web/components/prompt-templates/template-builder';
import { orpcClient } from '@/web/lib/orpc';

const searchSchema = z.object({
  run: z.boolean().optional(),
});

export const Route = createFileRoute('/dashboard/prompt-templates/$templateId')(
  {
    validateSearch: searchSchema,
    loader: ({ params }) =>
      orpcClient.promptTemplates.get({ id: params.templateId }),
    component: EditTemplatePage,
  },
);

function EditTemplatePage() {
  const template = Route.useLoaderData();
  const { run } = Route.useSearch();

  if (!template) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Template not found.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <TemplateBuilder template={template} autoRun={run} />
      </div>
    </div>
  );
}
