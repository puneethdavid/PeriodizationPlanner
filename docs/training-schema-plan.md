# Initial Training Schema Plan

This document defines the first-pass SQLite schema direction for Phase 2 work. It is intentionally specific enough to guide domain and persistence implementation, but it does not commit the app to every future field or table today.

## Planning Goals

- Support benchmark-driven block generation for one primary local user.
- Keep planned training data, logged results, and adaptation history distinct.
- Leave room for future health inputs and adaptation explanations without forcing a generic multi-tenant model.
- Preserve a migration path as tables move from planning into concrete SQLite definitions.

## Core MVP Entities

### Benchmarks

Purpose: Store the baseline performance inputs used to generate blocks and derive training maxes.

Suggested fields:

- `id`
- `captured_at`
- `exercise_slug`
- `exercise_name`
- `benchmark_type`
- `benchmark_value`
- `benchmark_unit`
- `notes`

MVP critical:

- identity
- exercise reference
- captured timestamp
- benchmark value and unit

Later-safe additions:

- source metadata
- confidence or test quality flags

### Training Blocks

Purpose: Represent a generated block as the top-level planning container.

Suggested fields:

- `id`
- `created_at`
- `updated_at`
- `name`
- `status`
- `goal_slug`
- `start_date`
- `end_date`
- `benchmark_snapshot_id`
- `generation_version`
- `notes`

MVP critical:

- identity
- lifecycle status
- scheduling window
- benchmark snapshot reference

Later-safe additions:

- archival metadata
- sync metadata

### Block Revisions

Purpose: Track meaningful plan revisions after generation or deterministic adaptation steps.

Suggested fields:

- `id`
- `block_id`
- `created_at`
- `revision_number`
- `reason`
- `summary`

MVP critical:

- revision ordering
- reason for change

Later-safe additions:

- richer diff payloads
- sync-safe event identifiers

### Planned Sessions

Purpose: Store the sessions generated inside a block.

Suggested fields:

- `id`
- `block_id`
- `block_revision_id`
- `scheduled_date`
- `session_index`
- `session_type`
- `title`
- `status`

MVP critical:

- block linkage
- ordering and date
- session status

Later-safe additions:

- readiness flags
- reminder metadata

### Planned Exercises

Purpose: Represent the exercise sequence within a planned session.

Suggested fields:

- `id`
- `session_id`
- `exercise_slug`
- `exercise_name`
- `exercise_order`
- `prescription_kind`

MVP critical:

- session linkage
- ordering
- exercise identity

Later-safe additions:

- coaching notes
- superset or grouping hints

### Planned Sets

Purpose: Hold target prescriptions for each exercise inside a planned session.

Suggested fields:

- `id`
- `planned_exercise_id`
- `set_index`
- `target_reps`
- `target_load`
- `target_rpe`
- `rest_seconds`
- `tempo`

MVP critical:

- ordering
- target reps and/or load

Later-safe additions:

- tempo
- advanced prescription metadata

### Workout Results

Purpose: Capture actual session completion and aggregate outcome state.

Suggested fields:

- `id`
- `session_id`
- `completed_at`
- `completion_status`
- `notes`
- `perceived_difficulty`

MVP critical:

- session linkage
- completion status
- completion timestamp

Later-safe additions:

- recovery notes
- subjective readiness deltas

### Logged Set Results

Purpose: Store actual performed set results separately from planned targets.

Suggested fields:

- `id`
- `workout_result_id`
- `planned_set_id`
- `set_index`
- `actual_reps`
- `actual_load`
- `actual_rpe`
- `is_completed`

MVP critical:

- linkage to workout result
- ordering
- actual reps and/or load

Later-safe additions:

- velocity or device-captured fields
- form notes

### Adaptation Events

Purpose: Record deterministic changes applied to a plan after feedback or logged results.

Suggested fields:

- `id`
- `block_id`
- `block_revision_id`
- `triggered_at`
- `event_type`
- `reason_code`
- `summary`

MVP critical:

- block linkage
- event type
- plain-language summary

Later-safe additions:

- richer structured payloads
- confidence or explanation metadata

### Explanation Records

Purpose: Store user-facing explanation text tied to generated plans or adaptations.

Suggested fields:

- `id`
- `owner_type`
- `owner_id`
- `created_at`
- `headline`
- `body`

MVP critical:

- ownership link
- concise explanation copy

Later-safe additions:

- explanation categories
- localization support

## Future-Compatible But Not MVP-Critical Inputs

These should be planned for, but not implemented yet as part of the core training schema:

- sleep logs
- bodyweight logs
- resting heart rate and cardio context
- reminder delivery records
- sync queue metadata

Those inputs should connect to training decisions through explicit adapters or feature modules rather than being mixed into core training tables prematurely.

## Relationship Outline

```text
Benchmarks
  -> Training Blocks
    -> Block Revisions
      -> Planned Sessions
        -> Planned Exercises
          -> Planned Sets
        -> Workout Results
          -> Logged Set Results
    -> Adaptation Events

Explanation Records
  -> can attach to Block Revisions, Adaptation Events, or Workout Results
```

## Migration Notes

- Start with additive migrations whenever possible.
- Keep revision or event history explicit instead of overwriting generated plans in place.
- Avoid storing large denormalized payload blobs as the primary representation when relational tables can express the MVP more clearly.
- Reserve sync-facing identifiers and metadata for later migrations rather than polluting initial MVP tables.

## Implementation Notes For Phase 2

- Domain models in the training feature should mirror these entities closely enough to keep mapping obvious.
- SQLite table definitions should choose stable singular or plural naming once implemented and use it consistently.
- Repository methods should return feature-safe records or domain models rather than raw rows leaking across the app.

Phase 2 issues for training entities, block generation, and workout execution should reference this plan directly when defining concrete tables and schema-backed repositories.
