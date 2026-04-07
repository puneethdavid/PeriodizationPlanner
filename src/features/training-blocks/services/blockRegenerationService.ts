import type { BlockConfiguration } from "@/features/training-blocks/schema/trainingBlockSchemas";
import { liftGoalLabels } from "@/features/training-blocks/services/blockConfigurationService";
import { formatTrainingWeekday } from "@/features/training-blocks/services/blockSchedulingService";

const formatWeekdayList = (weekdays: readonly BlockConfiguration["schedulingPreferences"]["selectedTrainingWeekdays"][number][]) =>
  weekdays
    .map((weekday) => formatTrainingWeekday(weekday))
    .filter((label): label is string => label !== null)
    .join(", ");

const formatLiftSlug = (liftSlug: string): string =>
  liftSlug
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

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

export const summarizeConfigurationChanges = (
  activeBlockConfiguration: BlockConfiguration | null,
  savedBlockConfiguration: BlockConfiguration | null,
): readonly string[] => {
  if (activeBlockConfiguration === null || savedBlockConfiguration === null) {
    return [];
  }

  const changes: string[] = [];

  if (activeBlockConfiguration.durationWeeks !== savedBlockConfiguration.durationWeeks) {
    changes.push(
      `Duration changed from ${activeBlockConfiguration.durationWeeks} to ${savedBlockConfiguration.durationWeeks} weeks.`,
    );
  }

  if (
    activeBlockConfiguration.schedulingPreferences.trainingDaysPerWeek !==
      savedBlockConfiguration.schedulingPreferences.trainingDaysPerWeek ||
    JSON.stringify(activeBlockConfiguration.schedulingPreferences.selectedTrainingWeekdays) !==
      JSON.stringify(savedBlockConfiguration.schedulingPreferences.selectedTrainingWeekdays)
  ) {
    changes.push(
      `Schedule changed to ${savedBlockConfiguration.schedulingPreferences.trainingDaysPerWeek} training days on ${formatWeekdayList(savedBlockConfiguration.schedulingPreferences.selectedTrainingWeekdays)}.`,
    );
  }

  if (activeBlockConfiguration.primaryGoal !== savedBlockConfiguration.primaryGoal) {
    changes.push(
      `Primary goal changed from ${liftGoalLabels[activeBlockConfiguration.primaryGoal]} to ${liftGoalLabels[savedBlockConfiguration.primaryGoal]}.`,
    );
  }

  if (activeBlockConfiguration.secondaryGoal !== savedBlockConfiguration.secondaryGoal) {
    changes.push(
      `Secondary goal changed from ${liftGoalLabels[activeBlockConfiguration.secondaryGoal]} to ${liftGoalLabels[savedBlockConfiguration.secondaryGoal]}.`,
    );
  }

  if (
    JSON.stringify(activeBlockConfiguration.benchmarkLiftSlugs) !==
    JSON.stringify(savedBlockConfiguration.benchmarkLiftSlugs)
  ) {
    changes.push(
      `Benchmark lifts changed to ${savedBlockConfiguration.benchmarkLiftSlugs.map((liftSlug) => formatLiftSlug(liftSlug)).join(", ")}.`,
    );
  }

  if (
    activeBlockConfiguration.primaryLiftsPerSession !== savedBlockConfiguration.primaryLiftsPerSession ||
    activeBlockConfiguration.secondaryLiftsPerSession !==
      savedBlockConfiguration.secondaryLiftsPerSession
  ) {
    changes.push(
      `Session composition changed to ${savedBlockConfiguration.primaryLiftsPerSession} primary and ${savedBlockConfiguration.secondaryLiftsPerSession} secondary lifts per session.`,
    );
  }

  if (
    JSON.stringify(activeBlockConfiguration.primaryLiftPool) !==
    JSON.stringify(savedBlockConfiguration.primaryLiftPool)
  ) {
    changes.push(
      `Primary lift pool changed to ${savedBlockConfiguration.primaryLiftPool.map((liftSlug) => formatLiftSlug(liftSlug)).join(", ")}.`,
    );
  }

  if (
    JSON.stringify(activeBlockConfiguration.secondaryLiftPool) !==
    JSON.stringify(savedBlockConfiguration.secondaryLiftPool)
  ) {
    changes.push(
      `Secondary lift pool changed to ${savedBlockConfiguration.secondaryLiftPool.map((liftSlug) => formatLiftSlug(liftSlug)).join(", ")}.`,
    );
  }

  return changes;
};
