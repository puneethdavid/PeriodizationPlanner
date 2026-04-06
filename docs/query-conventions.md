# Query Conventions

TanStack Query is the async boundary for the app, even when data is fully local. In the MVP, query functions should read from local repositories first and treat SQLite-backed state as the source of truth.

## Conventions

- Keep one app-wide query client at the root provider layer.
- Define query keys in `src/query/queryKeys.ts`.
- Query hooks should call repositories or feature services, not raw SQLite APIs directly.
- Mutations should write through repositories, then invalidate or update the affected local query keys.
- Prefer feature-owned query hooks under `src/features/<feature>/queries/`.

## Query Key Shape

- Start with the feature area.
- Add the resource or view name next.
- Add stable identifiers last.

Examples:

- `["app-shell", "database-summary"]`
- `["training-blocks", "detail", blockId]`
- `["today", "active-session"]`

## Local-First Mutation Pattern

1. Call a repository or feature service.
2. Persist locally first.
3. Invalidate or update the relevant query keys.
4. Let future sync react to local changes later instead of coupling remote behavior into the screen.
