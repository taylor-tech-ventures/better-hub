/**
 * Grouped confirmation card for multiple tool approval requests in a single AI response.
 *
 * When the AI calls multiple destructive tools at once, this card aggregates them
 * so users can review, exclude individual operations, then approve or deny the group.
 */

import type { ToolUIPart } from 'ai';
import { AlertTriangleIcon, CheckIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

const chatTs = () => {
  const d = new Date();
  return `[chat ${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}]`;
};

import { Badge } from '@/web/components/ui/badge';
import { Button } from '@/web/components/ui/button';
import { Checkbox } from '@/web/components/ui/checkbox';
import { cn } from '@/web/lib/utils';

// ============================================================================
// Types
// ============================================================================

type ApprovalRequestedToolPart = ToolUIPart & { state: 'approval-requested' };

export type ToolGroupConfirmationCardProps = {
  /** All approval-requested tool parts from a single assistant message */
  parts: ApprovalRequestedToolPart[];
  /** Callback to submit individual approval responses (sends WS + updates client state) */
  addToolApprovalResponse: (options: { id: string; approved: boolean }) => void;
  /** Agent WebSocket connection for sending manual approval messages */
  agent: { send: (data: string) => void };
  className?: string;
};

// ============================================================================
// ToolGroupConfirmationCard
// ============================================================================

/**
 * Renders a single grouped confirmation card for multiple tool calls requiring approval.
 *
 * Users can:
 * - Review each tool's name and parameters
 * - Uncheck individual tools to exclude them from group approval
 * - Click "Approve Selected" to approve included tools and deny excluded ones
 * - Click "Deny All" to reject every tool in the group
 */
export const ToolGroupConfirmationCard = ({
  parts,
  addToolApprovalResponse,
  agent,
  className,
}: ToolGroupConfirmationCardProps) => {
  // Track which tools are checked (included) for group approval
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(parts.map((p) => p.approval.id)),
  );

  const toggleTool = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApproveSelected = () => {
    const checked = parts.filter((p) => checkedIds.has(p.approval.id));
    const denied = parts.filter((p) => !checkedIds.has(p.approval.id));

    console.debug(
      `${chatTs()} handleApproveSelected — checked=${checked.length}, denied=${denied.length}`,
    );

    for (const part of denied) {
      console.debug(
        `${chatTs()} group deny — approvalId=${part.approval.id.slice(0, 8)}… toolCallId=${part.toolCallId.slice(0, 8)}…`,
      );
      addToolApprovalResponse({ id: part.approval.id, approved: false });
    }

    for (let i = 0; i < checked.length; i++) {
      const part = checked[i];
      const isLast = i === checked.length - 1;

      if (!isLast) {
        console.debug(
          `${chatTs()} group manual WS send — toolCallId=${part.toolCallId.slice(0, 8)}… autoContinue=false`,
        );
        agent.send(
          JSON.stringify({
            type: 'cf_agent_tool_approval',
            toolCallId: part.toolCallId,
            approved: true,
            autoContinue: false,
          }),
        );
      }
      console.debug(
        `${chatTs()} group addToolApprovalResponse — approvalId=${part.approval.id.slice(0, 8)}… approved=true isLast=${isLast}`,
      );
      addToolApprovalResponse({ id: part.approval.id, approved: true });
    }
  };

  const handleDenyAll = () => {
    console.debug(`${chatTs()} handleDenyAll — count=${parts.length}`);
    for (const part of parts) {
      console.debug(
        `${chatTs()} deny — approvalId=${part.approval.id.slice(0, 8)}… toolCallId=${part.toolCallId.slice(0, 8)}…`,
      );
      addToolApprovalResponse({ id: part.approval.id, approved: false });
    }
  };

  const checkedCount = checkedIds.size;
  const totalCount = parts.length;

  return (
    <div
      role="region"
      aria-label="Group tool approval request"
      className={cn(
        'rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/30',
        className,
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
        <div>
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {totalCount} operations require approval
          </p>
          <p className="mt-0.5 text-xs text-yellow-700/80 dark:text-yellow-300/80">
            Uncheck individual operations to exclude them, then approve the
            rest.
          </p>
        </div>
      </div>

      {/* Tool list */}
      <ul className="mb-4 space-y-2">
        {parts.map((part) => {
          const toolName = part.type.split('-').slice(1).join('-');
          const isChecked = checkedIds.has(part.approval.id);

          return (
            <li
              key={part.toolCallId}
              className={cn(
                'flex items-start gap-3 rounded-md border bg-white/60 p-3 transition-opacity dark:bg-black/20',
                !isChecked && 'opacity-50',
              )}
            >
              <Checkbox
                id={`tool-${part.toolCallId}`}
                checked={isChecked}
                onCheckedChange={() => toggleTool(part.approval.id)}
                className="mt-0.5 shrink-0"
                aria-label={`Include ${toolName} in approval`}
              />
              <label
                htmlFor={`tool-${part.toolCallId}`}
                className="min-w-0 flex-1 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{toolName}</span>
                  <Badge variant="secondary" className="text-xs">
                    pending
                  </Badge>
                </div>
                {part.input !== undefined && (
                  <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                    <code>{JSON.stringify(part.input, null, 2)}</code>
                  </pre>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-yellow-700/70 dark:text-yellow-300/70">
          {checkedCount} of {totalCount} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950/30"
            onClick={handleDenyAll}
          >
            <XIcon className="mr-1 size-3.5" />
            Deny All
          </Button>
          <Button
            size="sm"
            disabled={checkedCount === 0}
            onClick={handleApproveSelected}
          >
            <CheckIcon className="mr-1 size-3.5" />
            Approve{checkedCount < totalCount ? ` (${checkedCount})` : ' All'}
          </Button>
        </div>
      </div>
    </div>
  );
};
