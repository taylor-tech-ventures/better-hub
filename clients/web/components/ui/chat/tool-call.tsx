import type { DynamicToolUIPart, ToolUIPart } from 'ai';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { isValidElement } from 'react';

import { Badge } from '@/web/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/web/components/ui/collapsible';
import { cn } from '@/web/lib/utils';

export type ToolCallProps = ComponentProps<typeof Collapsible>;

export const ToolCall = ({ className, ...props }: ToolCallProps) => (
  <Collapsible
    className={cn('group mb-4 w-full rounded-md border', className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolCallHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart['type']; state: ToolUIPart['state']; toolName?: never }
  | {
      type: DynamicToolUIPart['type'];
      state: DynamicToolUIPart['state'];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart['state'], string> = {
  'approval-requested': 'Awaiting Approval',
  'approval-responded': 'Responded',
  'input-available': 'Running',
  'input-streaming': 'Pending',
  'output-available': 'Completed',
  'output-denied': 'Denied',
  'output-error': 'Error',
};

const statusIcons: Record<ToolPart['state'], ReactNode> = {
  'approval-requested': <ClockIcon className="size-4 text-yellow-600" />,
  'approval-responded': <CheckCircleIcon className="size-4 text-blue-600" />,
  'input-available': <ClockIcon className="size-4 animate-pulse" />,
  'input-streaming': <CircleIcon className="size-4" />,
  'output-available': <CheckCircleIcon className="size-4 text-green-600" />,
  'output-denied': <XCircleIcon className="size-4 text-orange-600" />,
  'output-error': <XCircleIcon className="size-4 text-red-600" />,
};

export const getToolStatusBadge = (status: ToolPart['state']) => (
  <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
    {statusIcons[status]}
    {statusLabels[status]}
  </Badge>
);

export const ToolCallHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolCallHeaderProps) => {
  const derivedName =
    type === 'dynamic-tool' ? toolName : type.split('-').slice(1).join('-');

  return (
    <CollapsibleTrigger
      className={cn(
        'flex w-full items-center justify-between gap-4 p-3',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <WrenchIcon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title ?? derivedName}</span>
        {getToolStatusBadge(state)}
      </div>
      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolCallContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolCallContent = ({
  className,
  ...props
}: ToolCallContentProps) => (
  <CollapsibleContent
    className={cn(
      'space-y-4 p-4 text-popover-foreground outline-none',
      className,
    )}
    {...props}
  />
);

export type ToolCallInputProps = ComponentProps<'div'> & {
  input: ToolPart['input'];
};

export const ToolCallInput = ({
  className,
  input,
  ...props
}: ToolCallInputProps) => (
  <div className={cn('space-y-2 overflow-hidden', className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded-md bg-muted/50 p-3">
      <pre className="overflow-x-auto text-xs">
        <code>{JSON.stringify(input, null, 2)}</code>
      </pre>
    </div>
  </div>
);

export type ToolCallOutputProps = ComponentProps<'div'> & {
  output: ToolPart['output'];
  errorText: ToolPart['errorText'];
};

export const ToolCallOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolCallOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let outputContent: ReactNode = <div>{output as ReactNode}</div>;

  if (typeof output === 'object' && !isValidElement(output)) {
    outputContent = (
      <pre className="overflow-x-auto text-xs">
        <code>{JSON.stringify(output, null, 2)}</code>
      </pre>
    );
  } else if (typeof output === 'string') {
    outputContent = (
      <pre className="overflow-x-auto text-xs">
        <code>{output}</code>
      </pre>
    );
  }

  return (
    <div className={cn('space-y-2', className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? 'Error' : 'Result'}
      </h4>
      <div
        className={cn(
          'overflow-x-auto rounded-md p-3 text-xs',
          errorText
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted/50 text-foreground',
        )}
      >
        {errorText && <div className="mb-2">{errorText}</div>}
        {outputContent}
      </div>
    </div>
  );
};
