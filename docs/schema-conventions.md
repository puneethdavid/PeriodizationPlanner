# Schema Conventions

Zod is the app's validation boundary library. Use it where unknown or external data enters the app, then pass validated values into domain logic.

## Where Schemas Belong

- Put shared reusable schemas in `src/schema/`.
- Put feature-specific schemas in `src/features/<feature>/schema/`.
- Keep config schemas near config modules when the schema is specific to one boundary.

## What Schemas Should Validate

- Runtime config
- Persistence record mapping
- Form or input payloads
- Future sync payloads or external integration data

## What Schemas Should Not Replace

- Domain invariants that are better expressed as explicit business logic
- Repository orchestration
- UI-only display formatting

## Usage Pattern

1. Parse unknown input with a Zod schema at the boundary.
2. Convert the validated shape into app-safe or domain-safe objects.
3. Pass the validated data deeper into repositories, services, or rules without re-reading raw input.
