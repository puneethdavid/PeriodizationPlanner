import {
  benchmarkEligibleExerciseSlugs,
  exerciseCatalog,
} from "@/features/training-blocks/domain/exerciseCatalog";
import type { Benchmark, BenchmarkInput } from "@/features/training-blocks/schema/trainingBlockSchemas";

type BenchmarkLiftSlug = (typeof benchmarkEligibleExerciseSlugs)[number];

export type BenchmarkDraftValues = Partial<Record<BenchmarkLiftSlug, string>>;
export type BenchmarkDraftErrors = Partial<Record<BenchmarkLiftSlug, string>>;

export const benchmarkFieldMetadata: Record<
  BenchmarkLiftSlug,
  { label: string; helperText: string; benchmarkType: BenchmarkInput["benchmarkType"] }
> = Object.fromEntries(
  benchmarkEligibleExerciseSlugs.map((liftSlug) => [
    liftSlug,
    {
      label: exerciseCatalog[liftSlug].label,
      helperText: `Enter your current best recent ${exerciseCatalog[liftSlug].benchmarkType.replaceAll("-", " ")} benchmark.`,
      benchmarkType: exerciseCatalog[liftSlug].benchmarkType,
    },
  ]),
) as Record<
  BenchmarkLiftSlug,
  { label: string; helperText: string; benchmarkType: BenchmarkInput["benchmarkType"] }
>;

export const createEmptyBenchmarkDrafts = (
  selectedLiftSlugs: readonly BenchmarkLiftSlug[] = benchmarkEligibleExerciseSlugs,
): BenchmarkDraftValues =>
  Object.fromEntries(selectedLiftSlugs.map((liftSlug) => [liftSlug, ""])) as BenchmarkDraftValues;

export const createBenchmarkDraftsFromSaved = (
  benchmarks: readonly Benchmark[],
  selectedLiftSlugs: readonly BenchmarkLiftSlug[] = benchmarkEligibleExerciseSlugs,
): BenchmarkDraftValues => {
  const drafts = createEmptyBenchmarkDrafts(selectedLiftSlugs);

  benchmarks.forEach((benchmark) => {
    if (selectedLiftSlugs.includes(benchmark.liftSlug as BenchmarkLiftSlug)) {
      drafts[benchmark.liftSlug as BenchmarkLiftSlug] = String(benchmark.value);
    }
  });

  return drafts;
};

export const validateBenchmarkDrafts = (
  drafts: BenchmarkDraftValues,
  selectedLiftSlugs: readonly BenchmarkLiftSlug[] = benchmarkEligibleExerciseSlugs,
): { inputs: readonly BenchmarkInput[]; errors: BenchmarkDraftErrors } => {
  const capturedAt = new Date().toISOString();
  const errors: BenchmarkDraftErrors = {};
  const inputs: BenchmarkInput[] = [];

  selectedLiftSlugs.forEach((liftSlug) => {
    const rawValue = drafts[liftSlug]?.trim() ?? "";

    if (rawValue.length === 0) {
      errors[liftSlug] = "Enter a benchmark value.";
      return;
    }

    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      errors[liftSlug] = "Enter a positive number.";
      return;
    }

    inputs.push({
      liftSlug,
      benchmarkType: benchmarkFieldMetadata[liftSlug].benchmarkType,
      value: parsedValue,
      unit: "kg",
      capturedAt,
      notes: null,
    });
  });

  return {
    inputs,
    errors,
  };
};
