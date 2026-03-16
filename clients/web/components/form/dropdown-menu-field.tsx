import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { useFieldContext } from '@/web/components/form/context';
import { Button } from '@/web/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/web/components/ui/dropdown-menu';
import { Label } from '@/web/components/ui/label';

interface DropdownMenuOption {
  label: string;
  value: string;
}

interface DropdownMenuFieldProps {
  label: string;
  placeholder?: string;
  options: DropdownMenuOption[];
  description?: string;
  menuLabel?: string;
}

export function DropdownMenuField({
  label,
  placeholder = 'Select an option...',
  options,
  description,
  menuLabel,
}: DropdownMenuFieldProps) {
  const field = useFieldContext<string>();
  const errorMessage = field.state.meta.errors
    .map((e) => (typeof e === 'string' ? e : e?.message))
    .filter(Boolean)
    .join(', ');

  const selectedOption = options.find(
    (option) => option.value === field.state.value,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={field.name}>{label}</Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id={field.name}
            variant="outline"
            className="w-full justify-between"
            onBlur={field.handleBlur}
            aria-describedby={errorMessage ? `${field.name}-error` : undefined}
            aria-invalid={!!errorMessage}
          >
            {selectedOption ? selectedOption.label : placeholder}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full">
          {menuLabel && (
            <>
              <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => field.handleChange(option.value)}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {errorMessage && (
        <p id={`${field.name}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
