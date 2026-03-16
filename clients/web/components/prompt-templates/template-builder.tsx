import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import type {
  ParameterBinding,
  PromptTemplate,
  PromptTemplateStep,
} from '@/shared/schemas/prompt-templates';
import { Badge } from '@/web/components/ui/badge';
import { Button } from '@/web/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';
import { Input } from '@/web/components/ui/input';
import { Label } from '@/web/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/web/components/ui/select';
import { Separator } from '@/web/components/ui/separator';
import { Textarea } from '@/web/components/ui/textarea';
import { orpcClient } from '@/web/lib/orpc';
import { generatePrompt } from '@/web/lib/prompt-templates/generate-prompt';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVAILABLE_TOOLS: Record<string, { label: string; params: string[] }> = {
  listUserOrgs: { label: 'List User Orgs', params: [] },
  listOrgRepos: { label: 'List Org Repos', params: ['org', 'type'] },
  listOrgTeams: { label: 'List Org Teams', params: ['org'] },
  getRepoBranches: {
    label: 'Get Repo Branches',
    params: ['org', 'repo'],
  },
  getRepoTeams: { label: 'Get Repo Teams', params: ['owner', 'repo'] },
};

const BINDING_TYPES = [
  'hardcoded',
  'input',
  'org_select',
  'repo_select',
  'team_select',
  'branch_select',
  'multi_repo_select',
  'step_reference',
] as const;

type BindingType = (typeof BINDING_TYPES)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDefaultBinding(type: BindingType): ParameterBinding {
  switch (type) {
    case 'hardcoded':
      return { type: 'hardcoded', value: '' };
    case 'input':
      return { type: 'input', label: '', placeholder: '', required: false };
    case 'org_select':
      return { type: 'org_select', label: '', required: false };
    case 'repo_select':
      return { type: 'repo_select', label: '', required: false };
    case 'team_select':
      return { type: 'team_select', label: '', required: false };
    case 'branch_select':
      return { type: 'branch_select', label: '', required: false };
    case 'multi_repo_select':
      return { type: 'multi_repo_select', label: '', required: false };
    case 'step_reference':
      return { type: 'step_reference', stepId: '', outputPath: '' };
  }
}

function createEmptyStep(): PromptTemplateStep {
  return {
    id: crypto.randomUUID(),
    toolName: 'listUserOrgs',
    label: '',
    parameters: {},
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BindingEditor({
  paramName,
  binding,
  steps,
  currentStepId,
  onChange,
}: {
  paramName: string;
  binding: ParameterBinding;
  steps: PromptTemplateStep[];
  currentStepId: string;
  onChange: (updated: ParameterBinding) => void;
}) {
  const precedingSteps = steps.filter(
    (s) => steps.indexOf(s) < steps.findIndex((x) => x.id === currentStepId),
  );

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="shrink-0">
          {paramName}
        </Badge>
        <Select
          value={binding.type}
          onValueChange={(val: string) => {
            onChange(createDefaultBinding(val as BindingType));
          }}
        >
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BINDING_TYPES.map((bt) => (
              <SelectItem key={bt} value={bt}>
                {bt.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {binding.type === 'hardcoded' && (
        <Input
          placeholder="Hardcoded value"
          value={String(binding.value ?? '')}
          onChange={(e) => onChange({ ...binding, value: e.target.value })}
        />
      )}

      {binding.type === 'input' && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Label"
            value={binding.label}
            onChange={(e) => onChange({ ...binding, label: e.target.value })}
          />
          <Input
            placeholder="Placeholder (optional)"
            value={binding.placeholder ?? ''}
            onChange={(e) =>
              onChange({ ...binding, placeholder: e.target.value })
            }
          />
        </div>
      )}

      {(binding.type === 'org_select' ||
        binding.type === 'repo_select' ||
        binding.type === 'team_select' ||
        binding.type === 'branch_select' ||
        binding.type === 'multi_repo_select') && (
        <Input
          placeholder="Label"
          value={binding.label}
          onChange={(e) => onChange({ ...binding, label: e.target.value })}
        />
      )}

      {(binding.type === 'repo_select' ||
        binding.type === 'team_select' ||
        binding.type === 'branch_select' ||
        binding.type === 'multi_repo_select') && (
        <Input
          placeholder="Org param reference (optional)"
          value={(binding as { orgParam?: string }).orgParam ?? ''}
          onChange={(e) =>
            onChange({
              ...binding,
              orgParam: e.target.value || undefined,
            } as ParameterBinding)
          }
        />
      )}

      {binding.type === 'branch_select' && (
        <Input
          placeholder="Repo param reference (optional)"
          value={binding.repoParam ?? ''}
          onChange={(e) =>
            onChange({
              ...binding,
              repoParam: e.target.value || undefined,
            })
          }
        />
      )}

      {binding.type === 'step_reference' && (
        <div className="flex gap-2">
          <Select
            value={binding.stepId}
            onValueChange={(val) => onChange({ ...binding, stepId: val })}
          >
            <SelectTrigger className="h-8 flex-1">
              <SelectValue placeholder="Select step" />
            </SelectTrigger>
            <SelectContent>
              {precedingSteps.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label || s.toolName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="flex-1"
            placeholder="Output path"
            value={binding.outputPath}
            onChange={(e) =>
              onChange({ ...binding, outputPath: e.target.value })
            }
          />
        </div>
      )}
    </div>
  );
}

function StepEditor({
  step,
  index,
  steps,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  step: PromptTemplateStep;
  index: number;
  steps: PromptTemplateStep[];
  onUpdate: (updated: PromptTemplateStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const toolDef = AVAILABLE_TOOLS[step.toolName];

  const handleToolChange = (toolName: string) => {
    const params = AVAILABLE_TOOLS[toolName]?.params ?? [];
    const newParams: Record<string, ParameterBinding> = {};
    for (const p of params) {
      newParams[p] = step.parameters[p] ?? createDefaultBinding('input');
    }
    onUpdate({ ...step, toolName, parameters: newParams });
  };

  const handleBindingChange = (
    paramName: string,
    binding: ParameterBinding,
  ) => {
    onUpdate({
      ...step,
      parameters: { ...step.parameters, [paramName]: binding },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Step {index + 1}</CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveUp}
              disabled={isFirst}
            >
              Up
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveDown}
              disabled={isLast}
            >
              Down
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Remove
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tool</Label>
            <Select value={step.toolName} onValueChange={handleToolChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AVAILABLE_TOOLS).map(([key, t]) => (
                  <SelectItem key={key} value={key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Label</Label>
            <Input
              value={step.label}
              onChange={(e) => onUpdate({ ...step, label: e.target.value })}
              placeholder="Describe what this step does"
            />
          </div>
        </div>

        {toolDef && toolDef.params.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">
              Parameter Bindings
            </Label>
            {toolDef.params.map((paramName) => (
              <BindingEditor
                key={paramName}
                paramName={paramName}
                binding={
                  step.parameters[paramName] ?? createDefaultBinding('input')
                }
                steps={steps}
                currentStepId={step.id}
                onChange={(b) => handleBindingChange(paramName, b)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface TemplateBuilderProps {
  template?: PromptTemplate;
  autoRun?: boolean;
}

export function TemplateBuilder({ template, autoRun }: TemplateBuilderProps) {
  const navigate = useNavigate();
  const isEditing = !!template;
  void autoRun;

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [tagsInput, setTagsInput] = useState(template?.tags.join(', ') ?? '');
  const [steps, setSteps] = useState<PromptTemplateStep[]>(
    template?.steps ?? [createEmptyStep()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput],
  );

  const currentTemplate = useMemo<PromptTemplate>(
    () => ({
      id: template?.id ?? crypto.randomUUID(),
      name,
      description,
      tags,
      steps,
      createdAt: template?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }),
    [name, description, tags, steps, template?.id, template?.createdAt],
  );

  const preview = useMemo(
    () => generatePrompt(currentTemplate, {}),
    [currentTemplate],
  );

  const updateStep = useCallback(
    (index: number, updated: PromptTemplateStep) => {
      setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));
    },
    [],
  );

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveStep = useCallback((index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const addStep = useCallback(() => {
    setSteps((prev) => [...prev, createEmptyStep()]);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }
    if (steps.length === 0) {
      setError('At least one step is required.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await orpcClient.promptTemplates.save(currentTemplate);
      navigate({ to: '/dashboard' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h2 className="text-2xl font-semibold">
        {isEditing ? 'Edit Template' : 'New Template'}
      </h2>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Name *</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My workflow template"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this template do?"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-tags">Tags (comma-separated)</Label>
            <Input
              id="template-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="audit, repos, teams"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Steps */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Steps</h3>
          <Button variant="outline" size="sm" onClick={addStep}>
            Add Step
          </Button>
        </div>

        {steps.map((step, index) => (
          <StepEditor
            key={step.id}
            step={step}
            index={index}
            steps={steps}
            onUpdate={(updated) => updateStep(index, updated)}
            onRemove={() => removeStep(index)}
            onMoveUp={() => moveStep(index, -1)}
            onMoveDown={() => moveStep(index, 1)}
            isFirst={index === 0}
            isLast={index === steps.length - 1}
          />
        ))}

        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No steps added yet. Click "Add Step" to get started.
          </p>
        )}
      </div>

      <Separator />

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Prompt Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
            {preview}
          </pre>
        </CardContent>
      </Card>

      {/* Actions */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pb-8">
        <Button
          variant="outline"
          onClick={() => navigate({ to: '/dashboard' })}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving
            ? 'Saving...'
            : isEditing
              ? 'Update Template'
              : 'Create Template'}
        </Button>
      </div>
    </div>
  );
}
