import type { BlockConfiguration } from "@/features/training-blocks/schema/trainingBlockSchemas";

export const regenerationRules = {
  strategy: "full-regeneration-only",
  summary:
    "Any saved block configuration change requires full regeneration. Partial schedule recalculation is not supported in MVP.",
  activeBlockReplacement:
    "When confirmed, the current active block is archived and a newly generated block becomes the active block in one local replacement flow.",
  previousSessionHandling:
    "Previously generated sessions remain attached to the archived block. Active plan reads switch to the new block only.",
} as const;

export const doesConfigurationRequireRegeneration = (
  activeBlockConfiguration: BlockConfiguration | null,
  savedBlockConfiguration: BlockConfiguration | null,
): boolean => {
  if (activeBlockConfiguration === null || savedBlockConfiguration === null) {
    return false;
  }

  return JSON.stringify(activeBlockConfiguration) !== JSON.stringify(savedBlockConfiguration);
};
