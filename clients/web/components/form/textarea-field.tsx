import * as React from 'react';

import { useFieldContext } from '@/web/components/form/context';
import { Label } from '@/web/components/ui/label';
import { Textarea } from '@/web/components/ui/textarea';

interface TextareaFieldProps {
  label: string;
  placeholder?: string;
  description?: string;
  rows?: number;
}

export function TextareaField({
  label,
  placeholder,
  description,
  rows,
}: TextareaFieldProps) {
  const field = useFieldContext<string>();
  const errorMessage = field.state.meta.errors
    .map((e) => (typeof e === 'string' ? e : e?.message))
    .filter(Boolean)
    .join(', ');

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={field.name}>{label}</Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Textarea
        id={field.name}
        name={field.name}
        placeholder={placeholder}
        rows={rows}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-describedby={errorMessage ? `${field.name}-error` : undefined}
        aria-invalid={!!errorMessage}
      />
      {errorMessage && (
        <p id={`${field.name}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
