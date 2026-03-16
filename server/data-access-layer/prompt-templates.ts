import { getPromptTemplateDOStub } from '@/server/durable-objects/prompt-template-stub';
import type {
  PromptTemplate,
  PromptTemplateRun,
  PromptTemplateSummary,
} from '@/shared/schemas/prompt-templates';

function getStub(env: Cloudflare.Env, userId: string) {
  return getPromptTemplateDOStub(env, userId);
}

export async function listPromptTemplates(
  env: Cloudflare.Env,
  userId: string,
): Promise<PromptTemplateSummary[]> {
  return getStub(env, userId).listTemplates();
}

export async function getPromptTemplate(
  env: Cloudflare.Env,
  userId: string,
  id: string,
): Promise<PromptTemplate | null> {
  return getStub(env, userId).getTemplate(id);
}

export async function savePromptTemplate(
  env: Cloudflare.Env,
  userId: string,
  template: PromptTemplate,
): Promise<PromptTemplate> {
  return getStub(env, userId).saveTemplate(template);
}

export async function deletePromptTemplate(
  env: Cloudflare.Env,
  userId: string,
  id: string,
): Promise<void> {
  return getStub(env, userId).deleteTemplate(id);
}

export async function recordPromptTemplateRun(
  env: Cloudflare.Env,
  userId: string,
  run: PromptTemplateRun,
): Promise<void> {
  return getStub(env, userId).recordRun(run);
}

export async function listPromptTemplateRuns(
  env: Cloudflare.Env,
  userId: string,
  templateId?: string,
  limit?: number,
): Promise<PromptTemplateRun[]> {
  return getStub(env, userId).listRuns(templateId, limit);
}
