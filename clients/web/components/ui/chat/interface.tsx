import { useAgentChat } from '@cloudflare/ai-chat/react';
import { useJsonRenderMessage } from '@json-render/react';
import { useAgent } from 'agents/react';
import type { UIMessage } from 'ai';
import { isStaticToolUIPart, isTextUIPart } from 'ai';
import {
  AlertTriangleIcon,
  BotIcon,
  CheckIcon,
  ClockIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
  ZapIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@/server/auth/client';
import type {
  GitHubAgentState,
  UsageStats,
} from '@/shared/types/github-agent-state';
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/web/components/ai-elements/confirmation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/web/components/ui/avatar';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/web/components/ui/chat/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/web/components/ui/chat/message';
import {
  PromptInput,
  PromptInputActions,
  PromptInputSubmitButton,
  PromptInputTextarea,
} from '@/web/components/ui/chat/prompt-input';
import { Suggestion, Suggestions } from '@/web/components/ui/chat/suggestion';
import {
  ToolCall,
  ToolCallContent,
  ToolCallHeader,
  ToolCallInput,
  ToolCallOutput,
} from '@/web/components/ui/chat/tool-call';
import { ToolGroupConfirmationCard } from '@/web/components/ui/chat/tool-group-confirmation';
import { ExplorerRenderer } from '@/web/json-render/renderer';
import { orpcClient } from '@/web/lib/orpc';
import { cn, userInitials } from '@/web/lib/utils';

// ============================================================================
// Debug logging
// ============================================================================

const chatTs = () => {
  const d = new Date();
  return `[chat ${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}]`;
};

// ============================================================================
// Helpers
// ============================================================================

/** Returns an ISO-8601 timestamp in the browser's local timezone, e.g. 2024-01-15T10:30:00+05:00 */
function toLocalISOString(date: Date): string {
  const tzOffset = -date.getTimezoneOffset();
  const sign = tzOffset >= 0 ? '+' : '-';
  const absOffset = Math.abs(tzOffset);
  const h = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const m = String(absOffset % 60).padStart(2, '0');
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return `${local.toISOString().slice(0, 19)}${sign}${h}:${m}`;
}

// ============================================================================
// Types
// ============================================================================

export type ChatInterfaceProps = {
  /** The agent namespace to connect to (e.g. "GitHubAgent") */
  agent: string;
  /** The agent instance name / user ID */
  name?: string;
  /** Additional CSS class names */
  className?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Empty state icon */
  emptyIcon?: ReactNode;
  /** Initial suggestions shown in the empty state */
  suggestions?: string[];
  /** Called when a suggestion is clicked - defaults to submitting the suggestion as a message */
  onSuggestionClick?: (
    suggestion: string,
    input: (value: string) => void,
  ) => void;
  /** Pre-filled prompt to send automatically on mount (e.g. from dashboard quick-ask) */
  initialPrompt?: string;
  /** Called after the initial prompt has been sent, e.g. to clear the URL search param */
  onInitialPromptSent?: () => void;
  /** Additional query parameters for the agent WebSocket connection */
  query?: Record<string, string | null>;
  /** Request headers */
  headers?: HeadersInit;
  /** Session for displaying user avatar and name on messages */
  session?: Session;
};

// ============================================================================
// MessageParts — renders text/tool parts + optional json-render spec
// ============================================================================

type MessagePartsProps = {
  message: UIMessage;
  addToolApprovalResponse: (options: { id: string; approved: boolean }) => void;
  agent: { send: (data: string) => void };
};

function MessageParts({
  message,
  addToolApprovalResponse,
  agent,
}: MessagePartsProps): ReactNode {
  const { spec, text, hasSpec } = useJsonRenderMessage(
    message.parts as { type: string; text?: string; data?: unknown }[],
  );

  // Deduplicate tool parts by toolCallId — racing continuations can produce
  // duplicate entries. Keep the last occurrence (most up-to-date state).
  const dedupedParts = useMemo(() => {
    const seen = new Map<string, number>();
    for (let i = 0; i < message.parts.length; i++) {
      const part = message.parts[i];
      if ('toolCallId' in part && typeof part.toolCallId === 'string') {
        seen.set(part.toolCallId, i);
      }
    }
    return message.parts.filter((part, idx) => {
      if ('toolCallId' in part && typeof part.toolCallId === 'string') {
        return seen.get(part.toolCallId) === idx;
      }
      return true;
    });
  }, [message.parts]);

  // Collect all static tool parts that are awaiting approval in this message
  const approvalPendingParts = useMemo(
    () =>
      dedupedParts.filter(
        (p): p is Extract<typeof p, { state: 'approval-requested' }> =>
          isStaticToolUIPart(p) && p.state === 'approval-requested',
      ),
    [dedupedParts],
  );

  const isGrouped = approvalPendingParts.length > 1;

  return (
    <>
      {text && <MessageResponse>{text}</MessageResponse>}

      {/* Grouped confirmation card — shown when multiple tools need approval at once */}
      {isGrouped && (
        <ToolGroupConfirmationCard
          parts={approvalPendingParts}
          addToolApprovalResponse={addToolApprovalResponse}
          agent={agent}
          className="mb-4"
        />
      )}

      {dedupedParts.map((part) => {
        if (isTextUIPart(part)) {
          return null;
        }

        if (isStaticToolUIPart(part)) {
          const toolName = part.type.split('-').slice(1).join('-');
          // When this part is part of a group, skip the individual approval UI
          const showIndividualApproval =
            part.state === 'approval-requested' && !isGrouped;

          return (
            <ToolCall key={part.toolCallId}>
              <ToolCallHeader type={part.type} state={part.state} />
              <ToolCallContent>
                {part.input !== undefined && (
                  <ToolCallInput input={part.input} />
                )}
                {showIndividualApproval && (
                  <Confirmation
                    approval={part.approval}
                    state={part.state}
                    className="mt-2"
                  >
                    <ConfirmationTitle>
                      <ConfirmationRequest>
                        <span>
                          Execute <code className="font-mono">{toolName}</code>?
                          This action may be irreversible.
                        </span>
                      </ConfirmationRequest>
                      <ConfirmationAccepted>
                        <CheckIcon className="size-4" />
                        <span>You approved this operation</span>
                      </ConfirmationAccepted>
                      <ConfirmationRejected>
                        <XIcon className="size-4" />
                        <span>You rejected this operation</span>
                      </ConfirmationRejected>
                    </ConfirmationTitle>
                    <ConfirmationActions>
                      <ConfirmationAction
                        variant="outline"
                        onClick={() =>
                          addToolApprovalResponse({
                            id: part.approval.id,
                            approved: false,
                          })
                        }
                      >
                        <XIcon className="mr-1 size-3.5" />
                        Deny
                      </ConfirmationAction>
                      <ConfirmationAction
                        onClick={() =>
                          addToolApprovalResponse({
                            id: part.approval.id,
                            approved: true,
                          })
                        }
                      >
                        <CheckIcon className="mr-1 size-3.5" />
                        Approve
                      </ConfirmationAction>
                    </ConfirmationActions>
                  </Confirmation>
                )}
                {(part.state === 'output-available' ||
                  part.state === 'output-error' ||
                  part.state === 'output-denied') && (
                  <ToolCallOutput
                    output={part.output}
                    errorText={
                      part.state === 'output-error' ? part.errorText : undefined
                    }
                  />
                )}
              </ToolCallContent>
            </ToolCall>
          );
        }

        if (part.type === 'dynamic-tool') {
          return (
            <ToolCall key={part.toolCallId}>
              <ToolCallHeader
                type={part.type}
                state={part.state}
                toolName={part.toolName}
              />
              <ToolCallContent>
                {part.input !== undefined && (
                  <ToolCallInput input={part.input} />
                )}
                {(part.state === 'output-available' ||
                  part.state === 'output-error' ||
                  part.state === 'output-denied') && (
                  <ToolCallOutput
                    output={
                      part.state === 'output-available'
                        ? part.output
                        : undefined
                    }
                    errorText={
                      part.state === 'output-error' ? part.errorText : undefined
                    }
                  />
                )}
              </ToolCallContent>
            </ToolCall>
          );
        }

        return null;
      })}
      {hasSpec && spec && <ExplorerRenderer spec={spec} />}
    </>
  );
}

// ============================================================================
// UsageMeter
// ============================================================================

type UsageMeterProps = {
  usage: UsageStats;
};

function UsageMeter({ usage }: UsageMeterProps): ReactNode {
  if (usage.isUnlimited) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ZapIcon className="size-3" />
        <span>Unlimited tools · {usage.tier}</span>
      </div>
    );
  }

  const pct = usage.limit > 0 ? usage.monthly / usage.limit : 0;
  const isAtLimit = pct >= 1;
  const isWarning = pct >= 0.8;
  const resetDate = new Date(usage.resetDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div
          className={cn(
            'flex items-center gap-1',
            isAtLimit
              ? 'text-destructive'
              : isWarning
                ? 'text-amber-500'
                : 'text-muted-foreground',
          )}
        >
          {isAtLimit || isWarning ? (
            <AlertTriangleIcon className="size-3" />
          ) : (
            <ZapIcon className="size-3" />
          )}
          <span>
            {usage.monthly}/{usage.limit} tool executions · {usage.tier}
          </span>
        </div>
        <span className="text-muted-foreground">Resets {resetDate}</span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isAtLimit
              ? 'bg-destructive'
              : isWarning
                ? 'bg-amber-500'
                : 'bg-primary',
          )}
          style={{ width: `${Math.min(pct * 100, 100)}%` }}
        />
      </div>

      {isAtLimit && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-destructive">
            Monthly limit reached — tools are disabled.
          </span>
          <a
            href="/dashboard/billing"
            className="font-medium text-primary hover:underline"
          >
            Upgrade plan →
          </a>
        </div>
      )}
      {isWarning && !isAtLimit && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-amber-500">Approaching monthly limit.</span>
          <a
            href="/dashboard/billing"
            className="font-medium text-primary hover:underline"
          >
            Upgrade plan →
          </a>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ChatInterface
// ============================================================================

export const ChatInterface = ({
  agent,
  name,
  className,
  placeholder = 'Message...',
  emptyTitle = 'How can I help you?',
  emptyDescription = 'Ask me anything to get started.',
  emptyIcon,
  suggestions = [],
  onSuggestionClick,
  initialPrompt,
  onInitialPromptSent,
  query,
  headers,
  session,
}: ChatInterfaceProps) => {
  const [inputValue, setInputValue] = useState('');
  const timestamps = useRef<Map<string, Date>>(new Map());

  const agentConnection = useAgent({ agent, name, query });

  // Pre-fetch usage stats so the meter is visible before the first tool execution.
  // The WebSocket state (updated after every tool run) takes precedence once available.
  const [initialUsage, setInitialUsage] = useState<UsageStats | null>(null);
  useEffect(() => {
    orpcClient.usage
      .get()
      .then(setInitialUsage)
      .catch(() => {});
  }, []);

  const wsUsage =
    (agentConnection as unknown as { state: GitHubAgentState | null }).state
      ?.usage ?? null;
  const usage = wsUsage ?? initialUsage;

  const {
    messages,
    sendMessage,
    addToolApprovalResponse: rawAddToolApprovalResponse,
    status,
    clearHistory,
  } = useAgentChat({
    agent: agentConnection,
    headers,
  });

  // Wrap addToolApprovalResponse with debug logging
  const addToolApprovalResponse = useCallback(
    (options: { id: string; approved: boolean }) => {
      console.debug(
        `${chatTs()} addToolApprovalResponse called — approvalId=${options.id.slice(0, 8)}… approved=${options.approved}`,
      );
      rawAddToolApprovalResponse(options);
    },
    [rawAddToolApprovalResponse],
  );

  // Log status changes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      console.debug(
        `${chatTs()} useAgentChat status: ${prevStatusRef.current} → ${status}`,
      );
      prevStatusRef.current = status;
    }
  }, [status]);

  // Log messages array changes with tool part details
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length !== prevMsgCountRef.current) {
      console.debug(
        `${chatTs()} messages changed: count ${prevMsgCountRef.current} → ${messages.length}`,
      );
      prevMsgCountRef.current = messages.length;
    }
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      const toolParts = msg.parts.filter(
        (p) => 'toolCallId' in p && typeof p.toolCallId === 'string',
      );
      if (toolParts.length > 0) {
        const summary = toolParts.map((p) => {
          const id =
            'toolCallId' in p && typeof p.toolCallId === 'string'
              ? p.toolCallId.slice(0, 8)
              : '?';
          const state = 'state' in p ? p.state : 'unknown';
          return `${id}…:${state}`;
        });
        console.debug(
          `${chatTs()} msg ${msg.id.slice(0, 8)}… tools(${toolParts.length}): [${summary.join(', ')}]`,
        );
      }
    }
  }, [messages]);

  const initialPromptSentRef = useRef(false);
  useEffect(() => {
    if (
      initialPrompt &&
      !initialPromptSentRef.current &&
      status === 'ready' &&
      messages.length === 0
    ) {
      initialPromptSentRef.current = true;
      sendMessage({ text: initialPrompt }).catch(console.error);
      onInitialPromptSent?.();
    }
  }, [
    initialPrompt,
    status,
    messages.length,
    sendMessage,
    onInitialPromptSent,
  ]);

  // Block prompt input while any tool in the last assistant message awaits approval
  const hasPendingApprovals = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (!lastAssistant) return false;
    return lastAssistant.parts.some(
      (p) => isStaticToolUIPart(p) && p.state === 'approval-requested',
    );
  }, [messages]);

  useEffect(() => {
    for (const message of messages) {
      if (!timestamps.current.has(message.id)) {
        timestamps.current.set(message.id, new Date());
      }
    }
  }, [messages]);

  const isLoading = status === 'streaming' || status === 'submitted';
  const isInputBlocked = isLoading || hasPendingApprovals;

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isInputBlocked) {
      return;
    }
    sendMessage({ text: trimmed }).catch(console.error);
    setInputValue('');
  }, [inputValue, isInputBlocked, sendMessage]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (onSuggestionClick) {
        onSuggestionClick(suggestion, setInputValue);
      } else {
        sendMessage({ text: suggestion }).catch(console.error);
      }
    },
    [onSuggestionClick, sendMessage],
  );

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <Conversation className="flex-1">
        {messages.length === 0 ? (
          <ConversationEmptyState
            title={emptyTitle}
            description={
              suggestions.length === 0 ? emptyDescription : undefined
            }
            icon={emptyIcon ?? <BotIcon className="size-8" />}
          >
            {suggestions.length > 0 && (
              <>
                <div className="text-muted-foreground text-sm">
                  {emptyDescription}
                </div>
                <Suggestions className="mt-4">
                  {suggestions.map((suggestion) => (
                    <Suggestion
                      key={suggestion}
                      suggestion={suggestion}
                      onClick={handleSuggestionClick}
                    />
                  ))}
                </Suggestions>
              </>
            )}
          </ConversationEmptyState>
        ) : (
          <ConversationContent>
            {messages.map((message) => {
              const ts = timestamps.current.get(message.id);
              const timestamp = ts ? toLocalISOString(ts) : undefined;
              const isUser = message.role === 'user';

              return (
                <Message key={message.id} from={message.role}>
                  {isUser ? (
                    <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground mb-1">
                      {timestamp && (
                        <time dateTime={timestamp}>{timestamp}</time>
                      )}
                      <span>
                        {session?.user.login ?? session?.user.name ?? 'You'}
                      </span>
                      <Avatar className="size-5">
                        <AvatarImage
                          src={session?.user.image ?? undefined}
                          alt={session?.user.name}
                        />
                        <AvatarFallback className="text-[10px]">
                          {session ? userInitials(session.user.name) : 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <BotIcon className="size-3.5" />
                      <span>Assistant</span>
                      {timestamp && (
                        <time dateTime={timestamp}>{timestamp}</time>
                      )}
                    </div>
                  )}
                  <MessageContent>
                    <MessageParts
                      message={message}
                      addToolApprovalResponse={addToolApprovalResponse}
                      agent={agentConnection}
                    />
                  </MessageContent>
                </Message>
              );
            })}
          </ConversationContent>
        )}
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-4">
        {usage && (
          <div className="mb-3">
            <UsageMeter usage={usage} />
          </div>
        )}
        {messages.length > 0 && (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={clearHistory}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Clear chat history"
            >
              <Trash2Icon className="size-3.5" />
              Clear history
            </button>
          </div>
        )}
        {hasPendingApprovals && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-400">
            <ClockIcon className="size-3.5 animate-pulse" />
            <span>Waiting for approval — respond above to continue</span>
          </div>
        )}
        <PromptInput
          value={inputValue}
          onValueChange={setInputValue}
          isLoading={isInputBlocked}
          onSubmit={handleSubmit}
          className={cn(
            hasPendingApprovals && 'opacity-50 pointer-events-none',
          )}
        >
          <PromptInputTextarea
            placeholder={
              hasPendingApprovals
                ? 'Approve or deny the pending operations above…'
                : placeholder
            }
            aria-label="Chat message input"
            disabled={hasPendingApprovals}
          />
          <PromptInputActions>
            <PromptInputSubmitButton disabled={hasPendingApprovals}>
              <SendIcon className="size-4" />
              <span className="sr-only">
                {isInputBlocked ? 'Stop' : 'Send'}
              </span>
            </PromptInputSubmitButton>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
};
