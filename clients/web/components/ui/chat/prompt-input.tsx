import { ArrowUpIcon, PaperclipIcon, SquareIcon, XIcon } from 'lucide-react';
import type {
  ChangeEventHandler,
  ComponentProps,
  FormEventHandler,
  KeyboardEventHandler,
} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

import { Button } from '@/web/components/ui/button';
import { Textarea } from '@/web/components/ui/textarea';
import { cn } from '@/web/lib/utils';

// ============================================================================
// Context
// ============================================================================

interface PromptInputContextType {
  value: string;
  setValue: (value: string) => void;
  isLoading: boolean;
  maxLength?: number;
  onSubmit?: () => void;
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  setValue: () => {},
  value: '',
});

const usePromptInput = () => useContext(PromptInputContext);

// ============================================================================
// PromptInput (Root)
// ============================================================================

export type PromptInputProps = ComponentProps<'div'> & {
  value?: string;
  defaultValue?: string;
  isLoading?: boolean;
  maxLength?: number;
  onValueChange?: (value: string) => void;
  onSubmit?: () => void;
};

export const PromptInput = ({
  className,
  value: controlledValue,
  defaultValue = '',
  isLoading = false,
  maxLength,
  onValueChange,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const setValue = useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange],
  );

  return (
    <PromptInputContext.Provider
      value={{ isLoading, maxLength, onSubmit, setValue, value }}
    >
      <div
        data-slot="prompt-input"
        className={cn(
          'border-input bg-background focus-within:ring-ring/50 flex flex-col gap-2 rounded-xl border p-3 shadow-sm focus-within:ring-[3px] focus-within:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </PromptInputContext.Provider>
  );
};

// ============================================================================
// PromptInputTextarea
// ============================================================================

export type PromptInputTextareaProps = Omit<
  ComponentProps<typeof Textarea>,
  'value' | 'onChange'
> & {
  disableAutosize?: boolean;
};

export const PromptInputTextarea = ({
  className,
  disableAutosize = false,
  onKeyDown,
  ...props
}: PromptInputTextareaProps) => {
  const { value, setValue, maxLength, onSubmit } = usePromptInput();

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      const newValue = e.target.value;
      if (maxLength && newValue.length > maxLength) {
        return;
      }
      setValue(newValue);
    },
    [setValue, maxLength],
  );

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        onSubmit?.();
      }
      onKeyDown?.(e);
    },
    [onSubmit, onKeyDown],
  );

  return (
    <Textarea
      data-slot="prompt-input-textarea"
      className={cn(
        'min-h-0 resize-none border-none bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
        !disableAutosize && 'field-sizing-content',
        className,
      )}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      rows={1}
      {...props}
    />
  );
};

// ============================================================================
// PromptInputActions
// ============================================================================

export type PromptInputActionsProps = ComponentProps<'div'>;

export const PromptInputActions = ({
  className,
  children,
  ...props
}: PromptInputActionsProps) => (
  <div
    data-slot="prompt-input-actions"
    className={cn('flex items-center gap-2', className)}
    {...props}
  >
    {children}
  </div>
);

// ============================================================================
// PromptInputSubmitButton
// ============================================================================

export type PromptInputSubmitButtonProps = Omit<
  ComponentProps<typeof Button>,
  'onClick'
>;

export const PromptInputSubmitButton = ({
  className,
  children,
  disabled,
  ...props
}: PromptInputSubmitButtonProps) => {
  const { isLoading, onSubmit, value } = usePromptInput();

  return (
    <Button
      className={cn('ml-auto size-8 rounded-full', className)}
      disabled={disabled ?? (!value.trim() && !isLoading)}
      onClick={onSubmit}
      size="icon"
      type="button"
      {...props}
    >
      {children ?? (
        <>
          {isLoading ? (
            <SquareIcon className="size-3 fill-current" />
          ) : (
            <ArrowUpIcon className="size-4" />
          )}
          <span className="sr-only">{isLoading ? 'Stop' : 'Send'}</span>
        </>
      )}
    </Button>
  );
};

// ============================================================================
// PromptInputCharacterCount
// ============================================================================

export type PromptInputCharacterCountProps = ComponentProps<'span'>;

export const PromptInputCharacterCount = ({
  className,
  ...props
}: PromptInputCharacterCountProps) => {
  const { value, maxLength } = usePromptInput();

  if (!maxLength) {
    return null;
  }

  const remaining = maxLength - value.length;
  const isNearLimit = remaining < maxLength * 0.1;

  return (
    <span
      className={cn(
        'text-muted-foreground text-xs',
        isNearLimit && 'text-destructive',
        className,
      )}
      {...props}
    >
      {value.length}/{maxLength}
    </span>
  );
};

// ============================================================================
// PromptInputAttachButton
// ============================================================================

export type PromptInputAttachButtonProps = Omit<
  ComponentProps<typeof Button>,
  'onClick'
> & {
  onAttach?: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
};

export const PromptInputAttachButton = ({
  className,
  children,
  onAttach,
  accept,
  multiple = true,
  ...props
}: PromptInputAttachButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      if (e.target.files?.length) {
        onAttach?.(e.target.files);
        e.target.value = '';
      }
    },
    [onAttach],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
      />
      <Button
        className={cn('size-8 rounded-full', className)}
        onClick={handleClick}
        size="icon"
        type="button"
        variant="ghost"
        {...props}
      >
        {children ?? <PaperclipIcon className="size-4" />}
        <span className="sr-only">Attach file</span>
      </Button>
    </>
  );
};

// ============================================================================
// PromptInputAttachments
// ============================================================================

export type Attachment = {
  id: string;
  name: string;
  url: string;
  mediaType: string;
};

export type PromptInputAttachmentsProps = ComponentProps<'div'> & {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
};

export const PromptInputAttachments = ({
  className,
  attachments,
  onRemove,
  ...props
}: PromptInputAttachmentsProps) => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="prompt-input-attachments"
      className={cn('flex flex-wrap gap-2', className)}
      {...props}
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-sm"
        >
          <span className="max-w-[120px] truncate">{attachment.name}</span>
          {onRemove && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onRemove(attachment.id)}
              aria-label={`Remove ${attachment.name}`}
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// PromptForm (wraps PromptInput with form semantics)
// ============================================================================

export type PromptFormProps = Omit<ComponentProps<'form'>, 'onSubmit'> & {
  onSubmit?: () => void;
};

export const PromptForm = ({
  className,
  onSubmit,
  children,
  ...props
}: PromptFormProps) => {
  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    (e) => {
      e.preventDefault();
      onSubmit?.();
    },
    [onSubmit],
  );

  return (
    <form
      data-slot="prompt-form"
      className={cn('w-full', className)}
      onSubmit={handleSubmit}
      {...props}
    >
      {children}
    </form>
  );
};
