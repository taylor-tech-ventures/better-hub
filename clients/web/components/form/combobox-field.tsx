import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { useFieldContext } from '@/web/components/form/context';
import { Button } from '@/web/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/web/components/ui/command';
import { Label } from '@/web/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/web/components/ui/popover';
import { cn } from '@/web/lib/utils';

interface ComboboxOption {
  label: string;
  value: string;
}

interface ComboboxFieldProps {
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  options: ComboboxOption[];
  description?: string;
}

export function ComboboxField({
  label,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  options,
  description,
}: ComboboxFieldProps) {
  const field = useFieldContext<string>();
  const [open, setOpen] = React.useState(false);

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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={field.name}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-describedby={errorMessage ? `${field.name}-error` : undefined}
            aria-invalid={!!errorMessage}
            className="w-full justify-between"
            onBlur={field.handleBlur}
          >
            {selectedOption ? selectedOption.label : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      field.handleChange(
                        currentValue === field.state.value ? '' : currentValue,
                      );
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        field.state.value === option.value
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
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
