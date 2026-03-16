import { z } from 'zod';

// ============================================================================
// Parameter Binding Types
// ============================================================================

const hardcodedBinding = z.object({
  type: z.literal('hardcoded'),
  value: z.unknown(),
});

const inputBinding = z.object({
  type: z.literal('input'),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
});

const orgSelectBinding = z.object({
  type: z.literal('org_select'),
  label: z.string(),
  required: z.boolean().optional(),
});

const repoSelectBinding = z.object({
  type: z.literal('repo_select'),
  label: z.string(),
  orgParam: z.string().optional(),
  required: z.boolean().optional(),
});

const teamSelectBinding = z.object({
  type: z.literal('team_select'),
  label: z.string(),
  orgParam: z.string().optional(),
  required: z.boolean().optional(),
});

const branchSelectBinding = z.object({
  type: z.literal('branch_select'),
  label: z.string(),
  orgParam: z.string().optional(),
  repoParam: z.string().optional(),
  required: z.boolean().optional(),
});

const multiRepoSelectBinding = z.object({
  type: z.literal('multi_repo_select'),
  label: z.string(),
  orgParam: z.string().optional(),
  required: z.boolean().optional(),
});

const stepReferenceBinding = z.object({
  type: z.literal('step_reference'),
  stepId: z.string(),
  outputPath: z.string(),
});

export const parameterBindingSchema = z.discriminatedUnion('type', [
  hardcodedBinding,
  inputBinding,
  orgSelectBinding,
  repoSelectBinding,
  teamSelectBinding,
  branchSelectBinding,
  multiRepoSelectBinding,
  stepReferenceBinding,
]);

export type ParameterBinding = z.infer<typeof parameterBindingSchema>;

// ============================================================================
// Step Schema
// ============================================================================

export const promptTemplateStepSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  label: z.string(),
  parameters: z.record(z.string(), parameterBindingSchema),
});

export type PromptTemplateStep = z.infer<typeof promptTemplateStepSchema>;

// ============================================================================
// Template Schema
// ============================================================================

export const promptTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  tags: z.array(z.string()).default([]),
  steps: z.array(promptTemplateStepSchema).min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type PromptTemplate = z.infer<typeof promptTemplateSchema>;

/** Lightweight summary returned by the list endpoint. */
export type PromptTemplateSummary = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  stepCount: number;
  updatedAt: number;
};

// ============================================================================
// Run Schema
// ============================================================================

export const stepResultSchema = z.object({
  stepId: z.string(),
  toolName: z.string(),
  status: z.enum(['success', 'failed', 'skipped']),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

export type StepResult = z.infer<typeof stepResultSchema>;

export const promptTemplateRunSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'partial']),
  inputs: z.record(z.string(), z.unknown()),
  startedAt: z.number(),
  completedAt: z.number().optional(),
  stepResults: z.array(stepResultSchema),
});

export type PromptTemplateRun = z.infer<typeof promptTemplateRunSchema>;

// ============================================================================
// Input schemas for oRPC procedures
// ============================================================================

export const saveTemplateInputSchema = promptTemplateSchema;

export const getTemplateInputSchema = z.object({ id: z.string() });

export const deleteTemplateInputSchema = z.object({ id: z.string() });

export const recordRunInputSchema = promptTemplateRunSchema;

export const listRunsInputSchema = z.object({
  templateId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
});
