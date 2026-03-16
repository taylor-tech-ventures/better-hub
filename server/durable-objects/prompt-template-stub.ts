import type { PromptTemplateDO } from '@/server/durable-objects/prompt-template';

export function getPromptTemplateDOStub(
  env: Pick<Cloudflare.Env, 'PromptTemplateDO'>,
  userId: string,
): DurableObjectStub<PromptTemplateDO> {
  const id = env.PromptTemplateDO.idFromName(userId);
  return env.PromptTemplateDO.get(id);
}
