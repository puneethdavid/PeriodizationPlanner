# Regeneration Rules

MVP uses one deterministic regeneration rule:

- Any saved block configuration change requires full regeneration.
- Partial rescheduling or selective recalculation is not supported.
- Confirmed regeneration archives the current active block and writes a newly generated block as the new active state.
- Previously generated sessions stay attached to the archived block, so reads for the active plan resolve only to the regenerated block.
