import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';

import { useFieldContext } from '@/web/components/form/context';
import { Button } from '@/web/components/ui/button';
import { Calendar } from '@/web/components/ui/calendar';
import { Label } from '@/web/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/web/components/ui/popover';
import { cn } from '@/web/lib/utils';

interface DatePickerFieldProps {
  label: string;
  placeholder?: string;
  description?: string;
  dateFormat?: string;
}

export function DatePickerField({
  label,
  placeholder = 'Pick a date',
  description,
  dateFormat = 'PPP',
}: DatePickerFieldProps) {
  const field = useFieldContext<Date | undefined>();
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
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={field.name}
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !field.state.value && 'text-muted-foreground',
            )}
            onBlur={field.handleBlur}
            aria-describedby={errorMessage ? `${field.name}-error` : undefined}
            aria-invalid={!!errorMessage}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {field.state.value
              ? format(field.state.value, dateFormat)
              : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={field.state.value}
            onSelect={field.handleChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {errorMessage && (
        <p id={`${field.name}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
