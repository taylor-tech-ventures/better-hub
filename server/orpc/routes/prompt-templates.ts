import {
  deletePromptTemplate,
  getPromptTemplate,
  listPromptTemplateRuns,
  listPromptTemplates,
  recordPromptTemplateRun,
  savePromptTemplate,
} from '@/server/data-access-layer/prompt-templates';
import { authorized, base } from '@/server/orpc/middleware';
import {
  deleteTemplateInputSchema,
  getTemplateInputSchema,
  listRunsInputSchema,
  recordRunInputSchema,
  saveTemplateInputSchema,
} from '@/shared/schemas/prompt-templates';

export const promptTemplates = {
  list: base
    .use(authorized)
    .handler(async ({ context }) =>
      listPromptTemplates(context.env, context.session.userId),
    ),

  get: base
    .use(authorized)
    .input(getTemplateInputSchema)
    .handler(async ({ input, context }) =>
      getPromptTemplate(context.env, context.session.userId, input.id),
    ),

  save: base
    .use(authorized)
    .input(saveTemplateInputSchema)
    .handler(async ({ input, context }) =>
      savePromptTemplate(context.env, context.session.userId, input),
    ),

  delete: base
    .use(authorized)
    .input(deleteTemplateInputSchema)
    .handler(async ({ input, context }) =>
      deletePromptTemplate(context.env, context.session.userId, input.id),
    ),

  runs: {
    record: base
      .use(authorized)
      .input(recordRunInputSchema)
      .handler(async ({ input, context }) =>
        recordPromptTemplateRun(context.env, context.session.userId, input),
      ),

    list: base
      .use(authorized)
      .input(listRunsInputSchema)
      .handler(async ({ input, context }) =>
        listPromptTemplateRuns(
          context.env,
          context.session.userId,
          input.templateId,
          input.limit,
        ),
      ),
  },
};
