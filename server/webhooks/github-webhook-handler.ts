import {
  getMatchingRules,
  logWebhookExecution,
} from '@/server/data-access-layer/webhook-automation';
import { createLogger } from '@/shared/logger';

const logger = createLogger({ module: 'github-webhook' });

/**
 * Verifies the GitHub webhook signature using HMAC-SHA256.
 * Uses timing-safe comparison to prevent timing attacks.
 */
async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = `sha256=${Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;

  if (expected.length !== signature.length) return false;

  const a = encoder.encode(expected);
  const b = encoder.encode(signature);
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function handleGitHubWebhook(
  request: Request,
  env: Cloudflare.Env,
): Promise<Response> {
  const eventType = request.headers.get('X-GitHub-Event');
  const signature = request.headers.get('X-Hub-Signature-256');

  if (!eventType) {
    return new Response('Missing X-GitHub-Event header', { status: 400 });
  }

  const body = await request.text();

  const webhookSecret = (env as Record<string, unknown>)
    .GITHUB_WEBHOOK_SECRET as string | undefined;
  if (webhookSecret) {
    if (!signature) {
      logger.warn('webhook request missing signature');
      return new Response('Missing X-Hub-Signature-256 header', {
        status: 401,
      });
    }
    const valid = await verifyWebhookSignature(body, signature, webhookSecret);
    if (!valid) {
      logger.warn('webhook signature verification failed');
      return new Response('Invalid signature', { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  const action = payload.action as string | undefined;
  const fullEventType = action ? `${eventType}.${action}` : eventType;
  const org =
    (payload.organization as { login?: string } | undefined)?.login ?? '';

  if (!org) {
    logger.debug({ eventType: fullEventType }, 'webhook without org, skipping');
    return new Response('OK', { status: 200 });
  }

  logger.info({ eventType: fullEventType, org }, 'processing webhook');

  try {
    const rules = await getMatchingRules(env, org, fullEventType);

    if (rules.length === 0) {
      logger.debug({ eventType: fullEventType, org }, 'no matching rules');
      return new Response('OK', { status: 200 });
    }

    const summary = buildEventSummary(fullEventType, payload);

    for (const rule of rules) {
      const conditionsMatch = evaluateConditions(rule.conditions, payload);
      if (!conditionsMatch) continue;

      const actionsTaken: string[] = [];
      let status: 'success' | 'error' = 'success';
      let error: string | undefined;

      for (const ruleAction of rule.actions) {
        try {
          actionsTaken.push(
            `${ruleAction.type}: ${JSON.stringify(ruleAction.params)}`,
          );
        } catch (err) {
          status = 'error';
          error = err instanceof Error ? err.message : String(err);
          logger.error({ err, ruleId: rule.id }, 'webhook action failed');
        }
      }

      await logWebhookExecution(env, {
        ruleId: rule.id,
        eventType: fullEventType,
        eventPayloadSummary: summary,
        actionsTaken,
        status,
        error,
      });
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    logger.error({ err }, 'webhook processing error');
    return new Response('Internal error', { status: 500 });
  }
}

function evaluateConditions(
  conditions: Array<{ field: string; operator: string; value: string }>,
  payload: Record<string, unknown>,
): boolean {
  for (const condition of conditions) {
    const fieldValue = getNestedValue(payload, condition.field);
    const strValue = String(fieldValue ?? '');

    switch (condition.operator) {
      case 'equals':
        if (strValue !== condition.value) return false;
        break;
      case 'not_equals':
        if (strValue === condition.value) return false;
        break;
      case 'contains':
        if (!strValue.includes(condition.value)) return false;
        break;
      case 'matches':
        try {
          if (!new RegExp(condition.value).test(strValue)) return false;
        } catch {
          return false;
        }
        break;
    }
  }
  return true;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current !== null && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function buildEventSummary(
  eventType: string,
  payload: Record<string, unknown>,
): string {
  const repo = (payload.repository as { full_name?: string } | undefined)
    ?.full_name;
  const sender = (payload.sender as { login?: string } | undefined)?.login;

  const parts = [`Event: ${eventType}`];
  if (repo) parts.push(`Repo: ${repo}`);
  if (sender) parts.push(`By: ${sender}`);
  return parts.join(' | ');
}
