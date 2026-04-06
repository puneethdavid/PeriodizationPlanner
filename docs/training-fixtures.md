# Training Fixture Strategy

This note defines the lightweight fixture path for the Phase 2 training-block engine.

## Goals

- Make benchmark-driven generation easy to exercise in development.
- Seed realistic but deterministic values for the initial supported lifts.
- Keep fixture setup aligned with the same repository and generation boundaries used by the app.

## Recommended Seed Flow

1. Upsert one benchmark per supported primary lift.
2. Generate a block from the saved benchmark rows rather than from ad hoc in-memory data.
3. Persist a benchmark snapshot alongside the generated block so later benchmark edits do not mutate historical plan inputs.
4. Save the block, initial revision, sessions, exercises, and planned sets in one transaction.

## Initial Fixture Coverage

- Back squat benchmark
- Bench press benchmark
- Deadlift benchmark
- Overhead press benchmark
- A deterministic four-week fixed progression block derived from those values

## Implementation Anchor

The current starter fixtures live in `src/features/training-blocks/fixtures/trainingFixtures.ts`.
Future dev-only seed commands should reuse that module instead of hardcoding separate example values in screens or route files.

## Current Dev Seed Path

- Use `DevTrainingSeedService.seedStarterTrainingDataAsync()` to reset local training data, insert the starter benchmark fixture set, and create one active deterministic training block.
- Use `DevTrainingSeedService.resetTrainingDataAsync()` when a screen or manual test needs a clean local training state.
- Both helpers are explicitly guarded behind `__DEV__` so production runtime does not depend on fixture workflows.
