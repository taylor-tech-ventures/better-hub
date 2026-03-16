import { useMemo, useState } from 'react';
import type { PromptTemplate } from '@/shared/schemas/prompt-templates';
import { Button } from '@/web/components/ui/button';
import { Input } from '@/web/components/ui/input';
import { Label } from '@/web/components/ui/label';
import { Separator } from '@/web/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/web/components/ui/sheet';
import type { DynamicInput } from '@/web/lib/prompt-templates/generate-prompt';
import {
  extractDynamicInputs,
  generatePrompt,
} from '@/web/lib/prompt-templates/generate-prompt';

type RunModalProps = {
  template: PromptTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (prompt: string) => void;
};

const BINDING_TYPE_LABELS: Record<DynamicInput['binding']['type'], string> = {
  input: 'Text',
  org_select: 'Organization',
  repo_select: 'Repository',
  team_select: 'Team',
  branch_select: 'Branch',
  multi_repo_select: 'Repositories',
};

function getPlaceholder(input: DynamicInput): string {
  const { binding } = input;
  if (binding.type === 'input' && binding.placeholder) {
    return binding.placeholder;
  }
  return `Enter ${BINDING_TYPE_LABELS[binding.type].toLowerCase()}...`;
}

function formatUsedInSteps(input: DynamicInput): string {
  const stepNumbers = input.usedInSteps.map((s) => `Step ${s.stepIndex + 1}`);
  return `Used in: ${stepNumbers.join(', ')}`;
}

export function RunModal({
  template,
  open,
  onOpenChange,
  onRun,
}: RunModalProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const dynamicInputs = useMemo(
    () => extractDynamicInputs(template),
    [template],
  );

  const isRunDisabled = dynamicInputs.some((input) => {
    const isRequired = input.binding.required !== false;
    const value = inputs[input.key]?.trim() ?? '';
    return isRequired && value === '';
  });

  const preview = useMemo(() => {
    return generatePrompt(template, inputs);
  }, [template, inputs]);

  function handleInputChange(key: string, value: string) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function handleRun() {
    const prompt = generatePrompt(template, inputs);
    onRun(prompt);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{template.name}</SheetTitle>
          <SheetDescription>{template.description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {dynamicInputs.length > 0 && (
            <div className="flex flex-col gap-4">
              {dynamicInputs.map((input) => (
                <div key={input.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`run-input-${input.key}`}>
                    {input.binding.label}
                    {input.binding.required !== false && (
                      <span className="ml-0.5 text-destructive">*</span>
                    )}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({BINDING_TYPE_LABELS[input.binding.type]})
                    </span>
                  </Label>
                  <Input
                    id={`run-input-${input.key}`}
                    placeholder={getPlaceholder(input)}
                    value={inputs[input.key] ?? ''}
                    onChange={(e) =>
                      handleInputChange(input.key, e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatUsedInSteps(input)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {dynamicInputs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This template has no configurable inputs.
            </p>
          )}

          <Separator className="my-4" />

          <div className="flex flex-col gap-1.5">
            <Label>Prompt Preview</Label>
            <pre className="max-h-48 overflow-y-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
              {preview}
            </pre>
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={handleRun}
            disabled={isRunDisabled}
            className="w-full"
          >
            Run Template
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
