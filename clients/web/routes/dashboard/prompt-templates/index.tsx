import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { PencilIcon, PlayIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import type { PromptTemplateSummary } from '@/shared/schemas/prompt-templates';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/web/components/ui/alert-dialog';
import { Badge } from '@/web/components/ui/badge';
import { Button } from '@/web/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/web/components/ui/table';
import { orpcClient } from '@/web/lib/orpc';

export const Route = createFileRoute('/dashboard/prompt-templates/')({
  loader: () => orpcClient.promptTemplates.list(),
  component: PromptTemplateListPage,
});

function PromptTemplateListPage() {
  const templates = Route.useLoaderData();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] =
    useState<PromptTemplateSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await orpcClient.promptTemplates.delete({ id: deleteTarget.id });
      void navigate({ to: '/dashboard/prompt-templates' });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Prompt Templates</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Reusable multi-step workflows for GitHub administration
              </p>
            </div>
            <Button asChild>
              <Link to="/dashboard/prompt-templates/new">
                <PlusIcon className="size-4 mr-2" />
                New Template
              </Link>
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No templates yet. Create your first template to get started.
                </p>
                <Button className="mt-4" asChild>
                  <Link to="/dashboard/prompt-templates/new">
                    <PlusIcon className="size-4 mr-2" />
                    Create Template
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {templates.length} template{templates.length !== 1 ? 's' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Steps</TableHead>
                      <TableHead className="w-32">Tags</TableHead>
                      <TableHead className="w-40">Updated</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">
                          <Link
                            to="/dashboard/prompt-templates/$templateId"
                            params={{ templateId: template.id }}
                            className="hover:underline"
                          >
                            {template.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                          {template.description || '—'}
                        </TableCell>
                        <TableCell>{template.stepCount}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {template.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(template.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Run"
                              onClick={() =>
                                navigate({
                                  to: '/dashboard/prompt-templates/$templateId',
                                  params: { templateId: template.id },
                                  search: { run: true },
                                })
                              }
                            >
                              <PlayIcon className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Edit"
                              asChild
                            >
                              <Link
                                to="/dashboard/prompt-templates/$templateId"
                                params={{ templateId: template.id }}
                              >
                                <PencilIcon className="size-3.5" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              title="Delete"
                              onClick={() => setDeleteTarget(template)}
                            >
                              <TrashIcon className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
