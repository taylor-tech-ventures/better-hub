import type {
  ParameterBinding,
  PromptTemplate,
} from '@/shared/schemas/prompt-templates';

/**
 * Generates a natural-language prompt from a template and user-provided inputs.
 * The AI agent interprets this prompt and calls the appropriate tools.
 */
export function generatePrompt(
  template: PromptTemplate,
  inputs: Record<string, unknown>,
): string {
  const lines: string[] = [`Execute the following workflow step by step:`, ''];

  for (let i = 0; i < template.steps.length; i++) {
    const step = template.steps[i];
    const paramDescriptions: string[] = [];

    for (const [paramName, binding] of Object.entries(step.parameters)) {
      const value = resolveBinding(binding, inputs, i);
      paramDescriptions.push(`${paramName}: ${formatValue(value)}`);
    }

    const paramStr =
      paramDescriptions.length > 0
        ? ` with ${paramDescriptions.join(', ')}`
        : '';
    lines.push(`${i + 1}. ${step.label}${paramStr}`);
  }

  lines.push('');
  lines.push('Report the result of each step as you go.');

  return lines.join('\n');
}

function resolveBinding(
  binding: ParameterBinding,
  inputs: Record<string, unknown>,
  _stepIndex: number,
): unknown {
  switch (binding.type) {
    case 'hardcoded':
      return binding.value;
    case 'input':
    case 'org_select':
    case 'repo_select':
    case 'team_select':
    case 'branch_select':
    case 'multi_repo_select': {
      const key = binding.label;
      return inputs[key] ?? `{${binding.type}}`;
    }
    case 'step_reference':
      return `{result of step ${binding.stepId}: ${binding.outputPath}}`;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Extracts all dynamic input fields from a template, deduplicating
 * inputs that share the same label across steps.
 */
export function extractDynamicInputs(template: PromptTemplate): DynamicInput[] {
  const seen = new Map<string, DynamicInput>();

  for (let i = 0; i < template.steps.length; i++) {
    const step = template.steps[i];
    for (const [paramName, binding] of Object.entries(step.parameters)) {
      if (binding.type === 'hardcoded' || binding.type === 'step_reference')
        continue;

      const key = binding.label;
      const existing = seen.get(key);
      if (existing) {
        existing.usedInSteps.push({ stepIndex: i, paramName });
      } else {
        seen.set(key, {
          key,
          binding,
          usedInSteps: [{ stepIndex: i, paramName }],
        });
      }
    }
  }

  return Array.from(seen.values());
}

export type DynamicInput = {
  key: string;
  binding: Exclude<
    ParameterBinding,
    { type: 'hardcoded' } | { type: 'step_reference' }
  >;
  usedInSteps: Array<{ stepIndex: number; paramName: string }>;
};
