const allowedAppEnvironments = ["development", "preview", "production"] as const;

export type AppEnvironment = (typeof allowedAppEnvironments)[number];

type RuntimeConfig = {
  appEnv: AppEnvironment;
  supabase: {
    url: string | null;
    anonKey: string | null;
  };
  notifications: {
    projectId: string | null;
  };
};

const isDevelopment = process.env.NODE_ENV !== "production";

const readEnv = (name: keyof typeof process.env): string | undefined => {
  const value = process.env[name];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const failConfig = (message: string): never => {
  throw new Error(`[runtimeConfig] ${message}`);
};

const readRequiredAppEnv = (): AppEnvironment => {
  const value = readEnv("EXPO_PUBLIC_APP_ENV");

  if (value === undefined) {
    failConfig(
      "Missing EXPO_PUBLIC_APP_ENV. Copy .env.example to .env and set EXPO_PUBLIC_APP_ENV for local development.",
    );
  }

  if (!allowedAppEnvironments.includes(value as AppEnvironment)) {
    failConfig(
      `Invalid EXPO_PUBLIC_APP_ENV "${value}". Expected one of: ${allowedAppEnvironments.join(", ")}.`,
    );
  }

  return value as AppEnvironment;
};

const readOptionalUrl = (name: keyof typeof process.env): string | null => {
  const value = readEnv(name);

  if (value === undefined) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.toString();
  } catch {
    failConfig(`${name} must be a valid absolute URL when provided.`);
  }

  return null;
};

const readOptionalString = (name: keyof typeof process.env): string | null => {
  return readEnv(name) ?? null;
};

export const runtimeConfig: RuntimeConfig = Object.freeze({
  appEnv: readRequiredAppEnv(),
  supabase: {
    url: readOptionalUrl("EXPO_PUBLIC_SUPABASE_URL"),
    anonKey: readOptionalString("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  },
  notifications: {
    projectId: readOptionalString("EXPO_PUBLIC_NOTIFICATIONS_PROJECT_ID"),
  },
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
