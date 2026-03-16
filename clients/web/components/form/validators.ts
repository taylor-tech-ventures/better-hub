/**
 * Zod validation utilities for TanStack Form.
 *
 * Zod v4 implements Standard Schema V1, which TanStack Form v1 supports
 * natively. This means Zod schemas can be passed directly as validators
 * to `form.AppField` without any adapter:
 *
 * @example Field-level validation
 * ```tsx
 * import { z } from '@/web/components/form/validators';
 *
 * <form.AppField
 *   name="email"
 *   validators={{
 *     onChange: z.string().email('Please enter a valid email'),
 *     onBlur: z.string().min(1, 'Email is required'),
 *   }}
 * >
 *   {(field) => <field.TextField label="Email" />}
 * </form.AppField>
 * ```
 *
 * @example Form-level (full schema) validation on submit
 * ```tsx
 * const form = useAppForm({
 *   defaultValues: { email: '', age: 0 },
 *   validators: {
 *     onSubmit: z.object({
 *       email: z.string().email(),
 *       age: z.number().min(18, 'Must be at least 18'),
 *     }),
 *   },
 *   onSubmit: async ({ value }) => { ... },
 * });
 * ```
 */

export type {
  ZodArray,
  ZodBoolean,
  ZodEnum,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
  ZodType,
} from 'zod';
export { z } from 'zod';
