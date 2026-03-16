import * as authSchema from '@/server/db/schemas/auth';
import * as schedulingSchema from '@/server/db/schemas/scheduling';

export const schema = {
  ...authSchema,
  ...schedulingSchema,
};
