import type { Benchmark, BenchmarkInput } from "@/features/training-blocks/schema/trainingBlockSchemas";

const benchmarkLiftOrder = [
  "back-squat",
  "bench-press",
  "deadlift",
  "overhead-press",
] as const satisfies readonly BenchmarkInput["liftSlug"][];

type BenchmarkLiftSlug = (typeof benchmarkLiftOrder)[number];

export type BenchmarkDraftValues = Record<BenchmarkLiftSlug, string>;
export type BenchmarkDraftErrors = Partial<Record<BenchmarkLiftSlug, string>>;

export const benchmarkFieldMetadata: Record<
  BenchmarkLiftSlug,
  { label: string; helperText: string; benchmarkType: BenchmarkInput["benchmarkType"] }
> = {
  "back-squat": {
    label: "Back squat",
    helperText: "Enter your current best recent five-rep benchmark.",
    benchmarkType: "five-rep-max",
  },
  "bench-press": {
    label: "Bench press",
    helperText: "Enter your current best recent five-rep benchmark.",
    benchmarkType: "five-rep-max",
  },
  deadlift: {
    label: "Deadlift",
    helperText: "Enter your current best recent three-rep benchmark.",
    benchmarkType: "three-rep-max",
  },
  "overhead-press": {
    label: "Overhead press",
    helperText: "Enter your current best recent five-rep benchmark.",
    benchmarkType: "five-rep-max",
  },
};

export const createEmptyBenchmarkDrafts = (): BenchmarkDraftValues => ({
  "back-squat": "",
  "bench-press": "",
  deadlift: "",
  "overhead-press": "",
});

export const createBenchmarkDraftsFromSaved = (
  benchmarks: readonly Benchmark[],
): BenchmarkDraftValues => {
  const drafts = createEmptyBenchmarkDrafts();

  benchmarks.forEach((benchmark) => {
    drafts[benchmark.liftSlug] = String(benchmark.value);
  });

  return drafts;
};

export const validateBenchmarkDrafts = (
  drafts: BenchmarkDraftValues,
): { inputs: readonly BenchmarkInput[]; errors: BenchmarkDraftErrors } => {
  const capturedAt = new Date().toISOString();
  const errors: BenchmarkDraftErrors = {};
  const inputs: BenchmarkInput[] = [];

  benchmarkLiftOrder.forEach((liftSlug) => {
    const rawValue = drafts[liftSlug].trim();

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
