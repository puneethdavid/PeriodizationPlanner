import { benchmarkFieldMetadata } from "@/features/training-blocks/services/benchmarkDraftService";
import type { Benchmark, BlockConfiguration } from "@/features/training-blocks/schema/trainingBlockSchemas";
import { liftGoalLabels } from "@/features/training-blocks/services/blockConfigurationService";
import { formatTrainingWeekday } from "@/features/training-blocks/services/blockSchedulingService";

const allBenchmarkLiftSlugs = Object.keys(benchmarkFieldMetadata) as (keyof typeof benchmarkFieldMetadata)[];

const formatLiftSlug = (liftSlug: keyof typeof benchmarkFieldMetadata): string =>
  benchmarkFieldMetadata[liftSlug].label;

const formatWeekdayList = (configuration: BlockConfiguration): string =>
  configuration.schedulingPreferences.selectedTrainingWeekdays
    .map((weekday) => formatTrainingWeekday(weekday))
    .filter((label): label is string => label !== null)
    .join(", ");

export const summarizeSavedBenchmarks = (
  benchmarks: readonly Benchmark[] | undefined,
): readonly string[] => {
  if (benchmarks === undefined) {
    return [];
  }

  const benchmarkByLiftSlug = new Map(benchmarks.map((benchmark) => [benchmark.liftSlug, benchmark] as const));

  return allBenchmarkLiftSlugs.map((liftSlug) => {
    const benchmark = benchmarkByLiftSlug.get(liftSlug);

    if (benchmark === undefined) {
      return `${formatLiftSlug(liftSlug)}: missing`;
    }

    return `${formatLiftSlug(liftSlug)}: ${benchmark.value} ${benchmark.unit} ${benchmark.benchmarkType}`;
  });
};

export const getMissingBenchmarkLiftLabels = (
  benchmarks: readonly Benchmark[] | undefined,
): readonly string[] => {
  const savedLiftSlugs = new Set((benchmarks ?? []).map((benchmark) => benchmark.liftSlug));

  return allBenchmarkLiftSlugs
    .filter((liftSlug) => !savedLiftSlugs.has(liftSlug))
    .map((liftSlug) => formatLiftSlug(liftSlug));
};

export const summarizeGenerationReview = (configuration: BlockConfiguration): readonly string[] => {
  return [
    `Duration: ${configuration.durationWeeks} weeks`,
    `Schedule: ${configuration.schedulingPreferences.trainingDaysPerWeek} training days on ${formatWeekdayList(configuration)}`,
    `Goals: ${liftGoalLabels[configuration.primaryGoal]} primary, ${liftGoalLabels[configuration.secondaryGoal]} secondary`,
    `Benchmark lifts: ${configuration.benchmarkLiftSlugs.map((liftSlug) => benchmarkFieldMetadata[liftSlug].label).join(", ")}`,
    `Session composition: ${configuration.primaryLiftsPerSession} primary + ${configuration.secondaryLiftsPerSession} secondary lifts per session`,
  ];
};

export const summarizeLiftPools = (configuration: BlockConfiguration): readonly string[] => {
  return [
    `Primary pool: ${configuration.primaryLiftPool.map((liftSlug) => benchmarkFieldMetadata[liftSlug].label).join(", ")}`,
    `Secondary pool: ${configuration.secondaryLiftPool.map((liftSlug) => benchmarkFieldMetadata[liftSlug].label).join(", ")}`,
  ];
};

export const getReadinessWarnings = (
  benchmarks: readonly Benchmark[] | undefined,
  configuration: BlockConfiguration | null | undefined,
): readonly string[] => {
  const warnings: string[] = [];
  const missingBenchmarkLiftLabels = getMissingBenchmarkLiftLabels(benchmarks);

  if (missingBenchmarkLiftLabels.length > 0) {
    warnings.push(`Still missing saved benchmark inputs for ${missingBenchmarkLiftLabels.join(", ")}.`);
  }

  if (configuration === null || configuration === undefined) {
    warnings.push("Save the block setup before generating an active block.");
    return warnings;
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
