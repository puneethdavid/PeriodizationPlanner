# MVP Architecture Note

This app is a local-first Expo + React Native client for a single primary user. During the MVP, SQLite is the source of truth for persisted app state, and cloud services are adapters around that core rather than the center of the system.

## Main Layers

### Routes and UI

- `app/` owns Expo Router route files and navigation structure.
- `src/components/` holds reusable presentational building blocks.
- Route files should stay thin: read data through hooks or services, render UI, and delegate non-trivial work elsewhere.

### Application Providers

- `src/providers/` composes app-wide runtime concerns such as query clients, theming, and future platform integrations.
- Providers should wire frameworks together, not hold feature logic.

### Runtime Config and Platform Adapters

- `src/config/` is the single entry point for public runtime configuration.
- Future platform-specific adapters such as notifications, device health access, or Supabase clients should live behind explicit modules in `src/lib/` or feature-owned adapter files instead of being called directly from route components.

### Domain Modules

- Feature-specific business logic belongs in feature folders under `src/features/`.
- Each feature module can grow to include:
  - `domain/` for entities, invariants, and deterministic rules
  - `services/` for use-case orchestration
  - `repository/` for persistence-facing contracts or queries
  - `schema/` for validation rules and DTO parsing
  - `ui/` for feature-owned reusable components or hooks

Example future shape:

```text
src/features/training-blocks/
  domain/
  repository/
  schema/
  services/
  ui/
```

### Persistence

- SQLite repositories persist and retrieve app data for the MVP.
- Repositories translate between storage records and domain-safe models.
- UI code should not construct SQL, storage keys, or sync payloads directly.

### Query Layer

- TanStack Query coordinates cached reads, invalidation, and async boundaries for local repositories first.
- Query hooks should call repositories or services, not embed domain rules in hook bodies.

### Sync and External Integrations

- Future Supabase sync should consume repository outputs or change events from explicit sync modules.
- Sync must not become the source of truth during MVP. Local persistence remains authoritative, and sync mirrors or reconciles with it later.
- Health or device integrations should enter through adapter modules that normalize external data before feature services use it.

## Local-First Data Flow

1. A route or screen triggers a feature action.
2. A feature service validates inputs and applies deterministic domain rules.
3. A repository writes to or reads from local SQLite storage.
4. Query invalidation or refetch updates the UI from local state.
5. Future sync or notification layers observe stable boundaries instead of reaching back into route code.

## Key Constraints

- Prefer deterministic, inspectable business rules over opaque behavior.
- Optimize for one-user-first workflows before designing for multi-user complexity.
- Keep public runtime config separate from secret or server-only concerns.
- Add future sync, health, or prediction modules as adapters around stable domain and repository boundaries.

## Current Repository Map

- `app/` routing shell and screen entry points
- `src/components/` shared UI building blocks
- `src/config/` public runtime configuration
- `src/database/` SQLite bootstrap, migrations, and repository foundations
- `src/providers/` app-wide framework composition
- `src/theme/` shared theme tokens

As the app grows, new work should prefer adding feature folders under `src/features/` instead of expanding route files into monoliths.
