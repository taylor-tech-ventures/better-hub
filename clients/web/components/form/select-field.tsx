import * as React from 'react';

import { useFieldContext } from '@/web/components/form/context';
import { Label } from '@/web/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/web/components/ui/select';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label: string;
  placeholder?: string;
  options: SelectOption[];
  description?: string;
}

export function SelectField({
  label,
  placeholder,
  options,
  description,
}: SelectFieldProps) {
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
      <Select
        name={field.name}
        value={field.state.value ?? ''}
        onValueChange={field.handleChange}
      >
        <SelectTrigger
          id={field.name}
          onBlur={field.handleBlur}
          aria-describedby={errorMessage ? `${field.name}-error` : undefined}
          aria-invalid={!!errorMessage}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errorMessage && (
        <p id={`${field.name}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
