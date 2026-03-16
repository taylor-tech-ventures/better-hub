import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { useFieldContext } from '@/web/components/form/context';
import { Label } from '@/web/components/ui/label';
import { Toggle, type toggleVariants } from '@/web/components/ui/toggle';

interface ToggleFieldProps extends VariantProps<typeof toggleVariants> {
  label: string;
  description?: string;
  toggleLabel?: string;
}

export function ToggleField({
  label,
  description,
  toggleLabel,
  variant,
  size,
}: ToggleFieldProps) {
  const field = useFieldContext<boolean>();
  const errorMessage = field.state.meta.errors
    .map((e) => (typeof e === 'string' ? e : e?.message))
    .filter(Boolean)
    .join(', ');

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Toggle
        aria-label={toggleLabel ?? label}
        pressed={field.state.value ?? false}
        onPressedChange={field.handleChange}
        onBlur={field.handleBlur}
        variant={variant}
        size={size}
        aria-describedby={errorMessage ? `${field.name}-error` : undefined}
        aria-invalid={!!errorMessage}
      >
        {toggleLabel ?? label}
      </Toggle>
      {errorMessage && (
        <p id={`${field.name}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
