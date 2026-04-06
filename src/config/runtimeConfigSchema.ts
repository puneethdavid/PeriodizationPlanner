import { z } from "zod";

import { nullableUrlStringSchema, optionalNullableStringSchema } from "@/schema/primitives";

export const appEnvironmentSchema = z.enum(["development", "preview", "production"]);

const rawRuntimeConfigSchema = z.object({
  EXPO_PUBLIC_APP_ENV: appEnvironmentSchema,
  EXPO_PUBLIC_SUPABASE_URL: nullableUrlStringSchema.optional().default(null),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: optionalNullableStringSchema,
  EXPO_PUBLIC_NOTIFICATIONS_PROJECT_ID: optionalNullableStringSchema,
});

export const runtimeConfigSchema = rawRuntimeConfigSchema.transform((values) => {
  return {
    appEnv: values.EXPO_PUBLIC_APP_ENV,
    supabase: {
      url: values.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: values.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
    notifications: {
      projectId: values.EXPO_PUBLIC_NOTIFICATIONS_PROJECT_ID,
    },
  };
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
