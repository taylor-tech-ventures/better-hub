import { base } from '@/server/orpc/middleware';
import { account } from '@/server/orpc/routes/account';
import { billing } from '@/server/orpc/routes/billing';
import { cliAuth } from '@/server/orpc/routes/cli-auth';
import { github } from '@/server/orpc/routes/github';
import { orgBilling } from '@/server/orpc/routes/org-billing';
import { preferences } from '@/server/orpc/routes/preferences';
import { promptTemplates } from '@/server/orpc/routes/prompt-templates';
import { queryHistory } from '@/server/orpc/routes/query-history';
import { scheduling } from '@/server/orpc/routes/scheduling';
import { usage } from '@/server/orpc/routes/usage';
import { webhookAutomation } from '@/server/orpc/routes/webhook-automation';
import { createLogger } from '@/shared/logger';

type HealthCheckStatus = 'healthy' | 'degraded';
type DependencyStatus = 'ok' | 'error';

type HealthCheckResult = {
  status: HealthCheckStatus;
  timestamp: string;
  checks: {
    d1: { status: DependencyStatus; latencyMs: number; error?: string };
    github: { status: DependencyStatus; latencyMs: number; error?: string };
  };
};

const healthLogger = createLogger({ module: 'health' });

export const router = {
  health: base.handler(async ({ context }): Promise<HealthCheckResult> => {
    const timestamp = new Date().toISOString();

    const [d1Result, githubResult] = await Promise.all([
      checkD1(context.env),
      checkGitHub(),
    ]);

    const status: HealthCheckStatus =
      d1Result.status === 'ok' && githubResult.status === 'ok'
        ? 'healthy'
        : 'degraded';

    if (status === 'degraded') {
      healthLogger.warn(
        { d1: d1Result, github: githubResult },
        'health check degraded',
      );
    }

    return {
      status,
      timestamp,
      checks: { d1: d1Result, github: githubResult },
    };
  }),
  account,
  billing,
  cliAuth,
  github,
  orgBilling,
  preferences,
  promptTemplates,
  queryHistory,
  scheduling,
  usage,
  webhookAutomation,
};

async function checkD1(
  env: Cloudflare.Env,
): Promise<{ status: DependencyStatus; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await env.GH_ADMIN_D1_PRIMARY.prepare('SELECT 1').first();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown D1 error',
    };
  }
}

async function checkGitHub(): Promise<{
  status: DependencyStatus;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const resp = await fetch('https://api.github.com/rate_limit', {
      headers: { 'User-Agent': 'gh-admin-health-check' },
    });
    if (!resp.ok) {
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        error: `GitHub API returned ${resp.status}`,
      };
    }
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown GitHub error',
    };
  }
}
