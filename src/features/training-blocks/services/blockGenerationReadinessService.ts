import {
  benchmarkEligibleExerciseSlugs,
  getExerciseLabel,
  type ExerciseSlug,
} from "@/features/training-blocks/domain/exerciseCatalog";
import type { Benchmark, BlockConfiguration } from "@/features/training-blocks/schema/trainingBlockSchemas";
import { liftGoalLabels } from "@/features/training-blocks/services/blockConfigurationService";
import { formatTrainingWeekday } from "@/features/training-blocks/services/blockSchedulingService";

const formatWeekdayList = (configuration: BlockConfiguration): string =>
  configuration.schedulingPreferences.selectedTrainingWeekdays
    .map((weekday) => formatTrainingWeekday(weekday))
    .filter((label): label is string => label !== null)
    .join(", ");

export const summarizeSavedBenchmarks = (
  benchmarks: readonly Benchmark[] | undefined,
  selectedLiftSlugs: readonly ExerciseSlug[] = benchmarkEligibleExerciseSlugs,
): readonly string[] => {
  if (benchmarks === undefined) {
    return [];
  }

  const benchmarkByLiftSlug = new Map(benchmarks.map((benchmark) => [benchmark.liftSlug, benchmark] as const));

  return selectedLiftSlugs.map((liftSlug) => {
    const benchmark = benchmarkByLiftSlug.get(liftSlug);

    if (benchmark === undefined) {
      return `${getExerciseLabel(liftSlug)}: missing`;
    }

    return `${getExerciseLabel(liftSlug)}: ${benchmark.value} ${benchmark.unit} ${benchmark.benchmarkType}`;
  });
};

export const getMissingBenchmarkLiftLabels = (
  benchmarks: readonly Benchmark[] | undefined,
  selectedLiftSlugs: readonly ExerciseSlug[] = benchmarkEligibleExerciseSlugs,
): readonly string[] => {
  const savedLiftSlugs = new Set((benchmarks ?? []).map((benchmark) => benchmark.liftSlug));

  return selectedLiftSlugs
    .filter((liftSlug) => !savedLiftSlugs.has(liftSlug))
    .map((liftSlug) => getExerciseLabel(liftSlug));
};

export const summarizeGenerationReview = (configuration: BlockConfiguration): readonly string[] => {
  return [
    `Duration: ${configuration.durationWeeks} weeks`,
    `Schedule: ${configuration.schedulingPreferences.trainingDaysPerWeek} training days on ${formatWeekdayList(configuration)}`,
    `Goals: ${liftGoalLabels[configuration.primaryGoal]} primary, ${liftGoalLabels[configuration.secondaryGoal]} secondary`,
    `Benchmark lifts: ${configuration.benchmarkLiftSlugs.map((liftSlug) => getExerciseLabel(liftSlug)).join(", ")}`,
    `Session composition: ${configuration.primaryLiftsPerSession} primary + ${configuration.secondaryLiftsPerSession} secondary lifts per session`,
  ];
};

export const summarizeLiftPools = (configuration: BlockConfiguration): readonly string[] => {
  return [
    `Primary pool: ${configuration.primaryLiftPool.map((liftSlug) => getExerciseLabel(liftSlug)).join(", ")}`,
    `Secondary pool: ${configuration.secondaryLiftPool.map((liftSlug) => getExerciseLabel(liftSlug)).join(", ")}`,
  ];
};

export const getReadinessWarnings = (
  benchmarks: readonly Benchmark[] | undefined,
  configuration: BlockConfiguration | null | undefined,
): readonly string[] => {
  const warnings: string[] = [];

  if (configuration === null || configuration === undefined) {
    warnings.push("Save the block setup before generating an active block.");
    return warnings;
  }

  const missingBenchmarkLiftLabels = getMissingBenchmarkLiftLabels(
    benchmarks,
    configuration.benchmarkLiftSlugs,
  );

  if (missingBenchmarkLiftLabels.length > 0) {
    warnings.push(`Still missing saved benchmark inputs for ${missingBenchmarkLiftLabels.join(", ")}.`);
  }

  if (configuration.benchmarkLiftSlugs.length === 0) {
    warnings.push("Select at least one benchmark lift for benchmark and final-test sessions.");
  }

  if (configuration.primaryLiftPool.length < configuration.primaryLiftsPerSession) {
    warnings.push("Primary session count exceeds the selected primary lift pool.");
  }

  if (configuration.secondaryLiftPool.length < configuration.secondaryLiftsPerSession) {
    warnings.push("Secondary session count exceeds the selected secondary lift pool.");
  }

  return warnings;
};
