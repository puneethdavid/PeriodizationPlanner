# Development Conventions

This project uses Expo, React Native, and TypeScript with a strict baseline so future changes stay predictable.

## Local checks

Run these before handing work off:

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`

Use `npm run format` or `npm run lint:fix` when you want automatic cleanup.

## TypeScript

- Keep `strict` mode enabled.
- Prefer explicit types when intent is not obvious from inference.
- Avoid `any`. Use `unknown` first and narrow it deliberately.

## Imports

- Use the `@/` alias for app source imports under `src/`.
- Keep relative imports for nearby files in the same folder only when they are simpler.

## Style

- Follow ESLint and Prettier as the source of truth for formatting and baseline code quality.
- Prefer small, typed modules with clear names over large utility files.
- Make the simplest change that preserves readability for the next agent.
