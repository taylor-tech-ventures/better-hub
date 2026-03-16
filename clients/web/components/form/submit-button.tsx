import * as React from 'react';

import { useFormContext } from '@/web/components/form/context';
import { Button } from '@/web/components/ui/button';

interface SubmitButtonProps {
  label?: string;
  submittingLabel?: string;
}

export function SubmitButton({
  label = 'Submit',
  submittingLabel = 'Submitting...',
}: SubmitButtonProps) {
  const form = useFormContext();

  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? submittingLabel : label}
        </Button>
      )}
    </form.Subscribe>
  );
}
