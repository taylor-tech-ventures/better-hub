import * as React from 'react';

import { useFieldContext } from '@/web/components/form/context';
import { Label } from '@/web/components/ui/label';
import { Slider } from '@/web/components/ui/slider';

interface SliderFieldProps {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export function SliderField({
  label,
  min = 0,
  max = 100,
  step = 1,
  description,
}: SliderFieldProps) {
  const field = useFieldContext<number>();
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
      <Slider
        id={field.name}
        name={field.name}
        min={min}
        max={max}
        step={step}
        value={[field.state.value ?? min]}
        onBlur={field.handleBlur}
        onValueChange={([value]) => field.handleChange(value)}
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
