import { DurableObject } from 'cloudflare:workers';
import { callable } from 'agents';
import type {
  PromptTemplate,
  PromptTemplateRun,
  PromptTemplateSummary,
} from '@/shared/schemas/prompt-templates';

type TemplateRow = {
  id: string;
  name: string;
  description: string;
  tags: string;
  steps: string;
  step_count: number;
  created_at: number;
  updated_at: number;
};

type RunRow = {
  id: string;
  template_id: string;
  status: string;
  inputs: string;
  started_at: number;
  completed_at: number | null;
  step_results: string;
};

export class PromptTemplateDO extends DurableObject<Cloudflare.Env> {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS prompt_templates (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          tags        TEXT NOT NULL DEFAULT '[]',
          steps       TEXT NOT NULL,
          step_count  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE INDEX IF NOT EXISTS idx_prompt_templates_updated
          ON prompt_templates(updated_at DESC)
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS prompt_template_runs (
          id           TEXT PRIMARY KEY,
          template_id  TEXT NOT NULL,
          status       TEXT NOT NULL DEFAULT 'running',
          inputs       TEXT NOT NULL DEFAULT '{}',
          started_at   INTEGER NOT NULL,
          completed_at INTEGER,
          step_results TEXT NOT NULL DEFAULT '[]',
          FOREIGN KEY (template_id) REFERENCES prompt_templates(id)
            ON DELETE CASCADE
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE INDEX IF NOT EXISTS idx_runs_template
          ON prompt_template_runs(template_id, started_at DESC)
      `);
    });
  }

  @callable()
  listTemplates(): PromptTemplateSummary[] {
    const rows = this.ctx.storage.sql
      .exec<
        Pick<
          TemplateRow,
          'id' | 'name' | 'description' | 'tags' | 'step_count' | 'updated_at'
        >
      >(
        'SELECT id, name, description, tags, step_count, updated_at FROM prompt_templates ORDER BY updated_at DESC',
      )
      .toArray();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      tags: JSON.parse(row.tags) as string[],
      stepCount: row.step_count,
      updatedAt: row.updated_at,
    }));
  }

  @callable()
  getTemplate(id: string): PromptTemplate | null {
    const rows = this.ctx.storage.sql
      .exec<TemplateRow>('SELECT * FROM prompt_templates WHERE id = ?', id)
      .toArray();

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      tags: JSON.parse(row.tags) as string[],
      steps: JSON.parse(row.steps),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  @callable()
  saveTemplate(template: Omit<PromptTemplate, 'userId'>): PromptTemplate {
    const now = Date.now();
    const stepCount = template.steps.length;
    const updatedAt = template.updatedAt || now;
    const createdAt = template.createdAt || now;

    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO prompt_templates
        (id, name, description, tags, steps, step_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      template.id,
      template.name,
      template.description,
      JSON.stringify(template.tags),
      JSON.stringify(template.steps),
      stepCount,
      createdAt,
      updatedAt,
    );

    return {
      ...template,
      createdAt,
      updatedAt,
    };
  }

  @callable()
  deleteTemplate(id: string): void {
    this.ctx.storage.sql.exec('DELETE FROM prompt_templates WHERE id = ?', id);
  }

  @callable()
  recordRun(run: PromptTemplateRun): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO prompt_template_runs
        (id, template_id, status, inputs, started_at, completed_at, step_results)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      run.id,
      run.templateId,
      run.status,
      JSON.stringify(run.inputs),
      run.startedAt,
      run.completedAt ?? null,
      JSON.stringify(run.stepResults),
    );
  }

  @callable()
  listRuns(templateId?: string, limit = 20): PromptTemplateRun[] {
    const rows = templateId
      ? this.ctx.storage.sql
          .exec<RunRow>(
            'SELECT * FROM prompt_template_runs WHERE template_id = ? ORDER BY started_at DESC LIMIT ?',
            templateId,
            limit,
          )
          .toArray()
      : this.ctx.storage.sql
          .exec<RunRow>(
            'SELECT * FROM prompt_template_runs ORDER BY started_at DESC LIMIT ?',
            limit,
          )
          .toArray();

    return rows.map((row) => ({
      id: row.id,
      templateId: row.template_id,
      status: row.status as PromptTemplateRun['status'],
      inputs: JSON.parse(row.inputs),
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      stepResults: JSON.parse(row.step_results),
    }));
  }
}
