/**
 * Confirmation components for tool approval workflows.
 *
 * Provides state-aware components that conditionally render based on
 * the current approval state — no manual state checks needed.
 *
 * Usage:
 * ```tsx
 * <Confirmation approval={part.approval} state={part.state}>
 *   <ConfirmationTitle>
 *     <ConfirmationRequest>Approve this action?</ConfirmationRequest>
 *     <ConfirmationAccepted><CheckIcon /> Approved</ConfirmationAccepted>
 *     <ConfirmationRejected><XIcon /> Rejected</ConfirmationRejected>
 *   </ConfirmationTitle>
 *   <ConfirmationActions>
 *     <ConfirmationAction variant="outline" onClick={...}>Reject</ConfirmationAction>
 *     <ConfirmationAction variant="default" onClick={...}>Approve</ConfirmationAction>
 *   </ConfirmationActions>
 * </Confirmation>
 * ```
 */

import type { ToolUIPart } from 'ai';
import type { ComponentProps, ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { Button } from '@/web/components/ui/button';
import { cn } from '@/web/lib/utils';

// ============================================================================
// Context
// ============================================================================

type ConfirmationState = ToolUIPart['state'];

type ConfirmationApproval = {
  id: string;
};

interface ConfirmationContextValue {
  state: ConfirmationState;
  approval: ConfirmationApproval | undefined;
}

const ConfirmationContext = createContext<ConfirmationContextValue>({
  state: 'approval-requested',
  approval: undefined,
});

const useConfirmation = () => useContext(ConfirmationContext);

// ============================================================================
// Confirmation (Root)
// ============================================================================

export type ConfirmationProps = ComponentProps<'div'> & {
  state: ConfirmationState;
  approval?: ConfirmationApproval;
};

/**
 * Root confirmation container. Provides state context to child components.
 * Renders an alert-style card that adapts to the current approval state.
 */
export const Confirmation = ({
  className,
  state,
  approval,
  children,
  ...props
}: ConfirmationProps) => (
  <ConfirmationContext.Provider value={{ approval, state }}>
    <div
      role="region"
      aria-label="Tool approval request"
      className={cn(
        'rounded-lg border p-4',
        state === 'approval-requested' &&
          'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30',
        state === 'output-available' &&
          'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
        (state === 'output-denied' || state === 'output-error') &&
          'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30',
        (state === 'approval-responded' || state === 'input-available') &&
          'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  </ConfirmationContext.Provider>
);

// ============================================================================
// ConfirmationTitle
// ============================================================================

export type ConfirmationTitleProps = ComponentProps<'div'>;

/**
 * Container for the state-specific title/message sub-components.
 * Place ConfirmationRequest, ConfirmationAccepted, and ConfirmationRejected inside.
 */
export const ConfirmationTitle = ({
  className,
  children,
  ...props
}: ConfirmationTitleProps) => (
  <div className={cn('mb-3', className)} {...props}>
    {children}
  </div>
);

// ============================================================================
// ConfirmationRequest
// ============================================================================

export type ConfirmationRequestProps = ComponentProps<'div'>;

/** Renders only when the approval is pending (state === 'approval-requested'). */
export const ConfirmationRequest = ({
  className,
  children,
  ...props
}: ConfirmationRequestProps): ReactNode => {
  const { state } = useConfirmation();
  if (state !== 'approval-requested') return null;
  return (
    <div
      className={cn('text-sm text-yellow-800 dark:text-yellow-200', className)}
      {...props}
    >
      {children}
    </div>
  );
};

// ============================================================================
// ConfirmationAccepted
// ============================================================================

export type ConfirmationAcceptedProps = ComponentProps<'div'>;

/** Renders only when the tool was approved and executed (state === 'output-available'). */
export const ConfirmationAccepted = ({
  className,
  children,
  ...props
}: ConfirmationAcceptedProps): ReactNode => {
  const { state } = useConfirmation();
  if (state !== 'output-available') return null;
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// ============================================================================
// ConfirmationRejected
// ============================================================================

export type ConfirmationRejectedProps = ComponentProps<'div'>;

/** Renders only when the tool was denied (state === 'output-denied' or 'output-error'). */
export const ConfirmationRejected = ({
  className,
  children,
  ...props
}: ConfirmationRejectedProps): ReactNode => {
  const { state } = useConfirmation();
  if (state !== 'output-denied' && state !== 'output-error') return null;
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-sm text-orange-700 dark:text-orange-300',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// ============================================================================
// ConfirmationActions
// ============================================================================

export type ConfirmationActionsProps = ComponentProps<'div'>;

/** Renders action buttons only when approval is pending. Disappears automatically after response. */
export const ConfirmationActions = ({
  className,
  children,
  ...props
}: ConfirmationActionsProps): ReactNode => {
  const { state } = useConfirmation();
  if (state !== 'approval-requested') return null;
  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      {children}
    </div>
  );
};

// ============================================================================
// ConfirmationAction
// ============================================================================

export type ConfirmationActionProps = ComponentProps<typeof Button>;

/** A button within ConfirmationActions. Passes all props through to Button. */
export const ConfirmationAction = ({
  size = 'sm',
  ...props
}: ConfirmationActionProps) => <Button size={size} {...props} />;
