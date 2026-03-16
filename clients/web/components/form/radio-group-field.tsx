import * as React from 'react';

import { useFieldContext } from '@/web/components/form/context';
import { Label } from '@/web/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/web/components/ui/radio-group';

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupFieldProps {
  label: string;
  options: RadioOption[];
  description?: string;
}

export function RadioGroupField({
  label,
  options,
  description,
}: RadioGroupFieldProps) {
  const field = useFieldContext<string>();
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
      <RadioGroup
        name={field.name}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onValueChange={field.handleChange}
        aria-describedby={errorMessage ? `${field.name}-error` : undefined}
        aria-invalid={!!errorMessage}
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <RadioGroupItem
              id={`${field.name}-${option.value}`}
              value={option.value}
            />
            <Label htmlFor={`${field.name}-${option.value}`}>
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {errorMessage && (
        <p id={`${field.name}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
