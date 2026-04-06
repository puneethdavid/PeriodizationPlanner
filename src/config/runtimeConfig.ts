import { runtimeConfigSchema, type RuntimeConfig } from "@/config/runtimeConfigSchema";
import { parseWithSchema } from "@/schema/parseWithSchema";

const isDevelopment = process.env.NODE_ENV !== "production";

export const runtimeConfig: RuntimeConfig = Object.freeze({
  ...parseWithSchema(
    runtimeConfigSchema,
    {
      EXPO_PUBLIC_APP_ENV: process.env["EXPO_PUBLIC_APP_ENV"],
      EXPO_PUBLIC_SUPABASE_URL: process.env["EXPO_PUBLIC_SUPABASE_URL"],
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"],
      EXPO_PUBLIC_NOTIFICATIONS_PROJECT_ID: process.env["EXPO_PUBLIC_NOTIFICATIONS_PROJECT_ID"],
    },
    "runtimeConfig",
  ),
});

if (isDevelopment) {
  const futureServiceSummaries = [
    runtimeConfig.supabase.url === null ? "supabase-url:pending" : "supabase-url:set",
    runtimeConfig.supabase.anonKey === null ? "supabase-key:pending" : "supabase-key:set",
    runtimeConfig.notifications.projectId === null ? "notifications:pending" : "notifications:set",
  ];

  console.info(
    `[runtimeConfig] Loaded ${runtimeConfig.appEnv} config (${futureServiceSummaries.join(", ")}).`,
  );
}
