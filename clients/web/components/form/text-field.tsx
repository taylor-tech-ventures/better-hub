import * as React from 'react';
import { useFieldContext } from '@/web/components/form/context';
import { Input } from '@/web/components/ui/input';
import { Label } from '@/web/components/ui/label';

interface TextFieldProps {
  label: string;
  placeholder?: string;
  type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
  description?: string;
}

export function TextField({
  label,
  placeholder,
  type = 'text',
  description,
}: TextFieldProps) {
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
      <Input
        id={field.name}
        name={field.name}
        type={type}
        placeholder={placeholder}
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
