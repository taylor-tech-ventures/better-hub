import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';

import {
  cleanupResolvedActions,
  insertAdminAction,
  updateAdminActionStatus,
} from '@/server/data-access-layer/admin-actions';
import { createLogger } from '@/shared/logger';

const workflowLogger = createLogger({ module: 'AdminActionWorkflow' });

export type AdminActionParams = {
  userId: string;
  /** Machine-readable action identifier, e.g. 'revoke-inactive-users' */
  action: string;
  /** Human-readable description shown in the confirmation UI */
  description: string;
  /** Arbitrary action-specific data */
  payload: Record<string, unknown>;
};

type ApprovalEvent = {
  approved: boolean;
  approvedBy: string;
};

export class AdminActionWorkflow extends WorkflowEntrypoint<
  Cloudflare.Env,
  AdminActionParams
> {
  async run(
    event: WorkflowEvent<AdminActionParams>,
    step: WorkflowStep,
  ): Promise<void> {
    const { userId, action, description, payload } = event.payload;

    // Step 0: Verify the user exists before creating the action record
    await step.do('validate-user', async () => {
      const row = await this.env.GH_ADMIN_D1_PRIMARY.prepare(
        'SELECT id FROM users WHERE id = ? LIMIT 1',
      )
        .bind(userId)
        .first<{ id: string }>();

      if (!row) throw new Error(`User ${userId} does not exist`);
    });

    // Step 1: Persist a pending confirmation record in D1
    const actionId = await step.do('create-pending-action', async () => {
      const id = crypto.randomUUID();
      await insertAdminAction(this.env.GH_ADMIN_D1_PRIMARY, {
        id,
        userId,
        action,
        description,
        payload,
        createdAt: new Date().toISOString(),
      });
      return id;
    });

    // Step 2: Wait for human approval — auto-deny after 24 hours
    const approval = await step.waitForEvent<ApprovalEvent>('human-approval', {
      timeout: '24 hours',
    });

    // Step 3: Execute or record denial
    await step.do('execute-or-deny', async () => {
      const status = approval.approved ? 'approved' : 'denied';
      await updateAdminActionStatus(
        this.env.GH_ADMIN_D1_PRIMARY,
        actionId,
        status,
        approval.approvedBy,
        new Date().toISOString(),
      );

      if (!approval.approved) return;

      // Dispatch: log the approved action for audit. Actual tool execution
      // happens in the AI chat context (which has access to the AI SDK and
      // GitHubAgent tools). The workflow's role is durable approval tracking.
      workflowLogger.info({ action, userId, payload }, 'action approved');
    });

    // Step 4: Housekeeping — clean up resolved actions older than 90 days
    await step.do('cleanup-old-actions', async () => {
      const deleted = await cleanupResolvedActions(
        this.env.GH_ADMIN_D1_PRIMARY,
        90,
      );
      if (deleted > 0) {
        workflowLogger.info(
          { deleted },
          'cleaned up resolved actions older than 90 days',
        );
      }
    });
  }
}
