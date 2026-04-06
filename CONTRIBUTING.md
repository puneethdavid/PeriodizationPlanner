# Development Conventions

This project uses Expo, React Native, and TypeScript with a strict baseline so future changes stay predictable.

## Local checks

Run these before handing work off:

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`

Use `npm run format` or `npm run lint:fix` when you want automatic cleanup.

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Keep runtime values in `EXPO_PUBLIC_*` variables only.
3. Read runtime config through `src/config/runtimeConfig.ts` rather than touching `process.env` in feature code.

Current local variables:

- `EXPO_PUBLIC_APP_ENV` required, one of `development`, `preview`, or `production`
- `EXPO_PUBLIC_SUPABASE_URL` optional placeholder for future sync work
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` optional placeholder for future sync work
- `EXPO_PUBLIC_NOTIFICATIONS_PROJECT_ID` optional placeholder for future notifications work

## TypeScript

- Keep `strict` mode enabled.
- Prefer explicit types when intent is not obvious from inference.
- Avoid `any`. Use `unknown` first and narrow it deliberately.

## Imports

- Use the `@/` alias for app source imports under `src/`.
- Keep relative imports for nearby files in the same folder only when they are simpler.

## Routes

- Expo Router lives in the `app/` directory and owns app navigation.
- Keep top-level shell routes in `app/(tabs)/` for the main user areas.
- Put shared providers, theme helpers, and reusable UI in `src/`.
- Keep route files thin and move reusable view code into `src/` when screens grow.

## Style

- Follow ESLint and Prettier as the source of truth for formatting and baseline code quality.
- Prefer small, typed modules with clear names over large utility files.
- Make the simplest change that preserves readability for the next agent.
