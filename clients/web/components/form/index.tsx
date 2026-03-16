import { createFormHook } from '@tanstack/react-form';

import { CheckboxField } from '@/web/components/form/checkbox-field';
import { ComboboxField } from '@/web/components/form/combobox-field';
import { fieldContext, formContext } from '@/web/components/form/context';
import { DatePickerField } from '@/web/components/form/date-picker-field';
import { DropdownMenuField } from '@/web/components/form/dropdown-menu-field';
import { RadioGroupField } from '@/web/components/form/radio-group-field';
import { SelectField } from '@/web/components/form/select-field';
import { SliderField } from '@/web/components/form/slider-field';
import { SubmitButton } from '@/web/components/form/submit-button';
import { SwitchField } from '@/web/components/form/switch-field';
import { TextField } from '@/web/components/form/text-field';
import { TextareaField } from '@/web/components/form/textarea-field';
import { ToggleField } from '@/web/components/form/toggle-field';
import { ToggleGroupField } from '@/web/components/form/toggle-group-field';

/**
 * Re-export mergeForm from @tanstack/form-core for use in SSR scenarios.
 * Use this to reconcile server-rendered form state with client-side state.
 *
 * @example
 * ```tsx
 * const serverState = Route.useLoaderData();
 * const form = useAppForm({
 *   defaultValues: { name: '' },
 *   defaultState: mergeForm({} as FormState<{ name: string }>, serverState),
 * });
 * ```
 */
export { mergeForm } from '@tanstack/form-core';
export {
  fieldContext,
  formContext,
  useFieldContext,
  useFormContext,
} from '@/web/components/form/context';

/**
 * Re-export Zod for field and form-level validation via Standard Schema V1.
 * Zod schemas can be passed directly as validators to `form.AppField`.
 *
 * @see {@link ./validators.ts} for usage examples.
 */
export { z } from '@/web/components/form/validators';

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    SelectField,
    CheckboxField,
    RadioGroupField,
    SwitchField,
    SliderField,
    ComboboxField,
    DatePickerField,
    ToggleField,
    ToggleGroupField,
    DropdownMenuField,
  },
  formComponents: {
    SubmitButton,
  },
});
