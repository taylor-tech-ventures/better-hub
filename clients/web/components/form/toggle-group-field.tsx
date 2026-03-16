import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { useFieldContext } from '@/web/components/form/context';
import { Label } from '@/web/components/ui/label';
import type { toggleVariants } from '@/web/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/web/components/ui/toggle-group';

interface ToggleGroupOption {
  label: string;
  value: string;
}

interface ToggleGroupFieldProps extends VariantProps<typeof toggleVariants> {
  label: string;
  options: ToggleGroupOption[];
  type?: 'single' | 'multiple';
  description?: string;
}

export function ToggleGroupField({
  label,
  options,
  type = 'single',
  description,
  variant,
  size,
}: ToggleGroupFieldProps) {
  const field = useFieldContext<string | string[]>();
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
      {type === 'multiple' ? (
        <ToggleGroup
          type="multiple"
          value={
            Array.isArray(field.state.value)
              ? (field.state.value as string[])
              : []
          }
          onValueChange={(value) => field.handleChange(value)}
          onBlur={field.handleBlur}
          variant={variant}
          size={size}
          aria-describedby={errorMessage ? `${field.name}-error` : undefined}
          aria-invalid={!!errorMessage}
        >
          {options.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <ToggleGroup
          type="single"
          value={
            Array.isArray(field.state.value)
              ? ''
              : ((field.state.value ?? '') as string)
          }
          onValueChange={(value) => field.handleChange(value)}
          onBlur={field.handleBlur}
          variant={variant}
          size={size}
          aria-describedby={errorMessage ? `${field.name}-error` : undefined}
          aria-invalid={!!errorMessage}
        >
          {options.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {errorMessage && (
        <p id={`${field.name}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
