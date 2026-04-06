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

## Queries

- Read and write app data through repositories, then expose it to screens through TanStack Query hooks.
- Define query keys in `src/query/queryKeys.ts`.
- Keep mutation side effects explicit: write through a repository, then invalidate the affected local query keys.
- Reference `docs/query-conventions.md` when adding new query hooks.

## Schemas

- Use Zod for unknown or external inputs at app boundaries.
- Put shared schemas in `src/schema/` and feature-specific schemas in `src/features/<feature>/schema/`.
- Parse raw inputs once, then pass validated values into repositories or domain services.
- Reference `docs/schema-conventions.md` before adding new validation modules.

## UI Primitives

- Put reusable mobile building blocks in `src/components/ui/`.
- Use `ScreenContainer` for route-level scaffolding and shared primitives for forms, cards, and state views.
- Prefer extending the primitive set carefully instead of creating one-off screen-only controls.

## Style

- Follow ESLint and Prettier as the source of truth for formatting and baseline code quality.
- Prefer small, typed modules with clear names over large utility files.
- Make the simplest change that preserves readability for the next agent.
- Reference `docs/architecture.md` before adding new feature modules or cross-cutting infrastructure.
