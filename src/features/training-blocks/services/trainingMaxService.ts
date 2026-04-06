import { parseWithSchema } from "@/schema/parseWithSchema";

import {
  benchmarkInputSchema,
  type Benchmark,
  type BenchmarkInput,
} from "@/features/training-blocks/schema/trainingBlockSchemas";

type TrainingMax = {
  liftSlug: Benchmark["liftSlug"];
  sourceBenchmarkType: Benchmark["benchmarkType"];
  sourceValue: number;
  sourceUnit: Benchmark["unit"];
  estimatedOneRepMax: number;
  trainingMax: number;
};

const benchmarkMultiplierByType: Record<Benchmark["benchmarkType"], number> = {
  "one-rep-max": 1,
  "three-rep-max": 1 / 0.93,
  "five-rep-max": 1 / 0.87,
  "working-weight": 1 / 0.75,
};

const roundToNearestLoadIncrement = (value: number, unit: Benchmark["unit"]): number => {
  const increment = unit === "kg" ? 2.5 : 5;
  return Number((Math.round(value / increment) * increment).toFixed(2));
};

export const deriveTrainingMaxFromBenchmark = (input: BenchmarkInput): TrainingMax => {
  const benchmark = parseWithSchema(
    benchmarkInputSchema,
    input,
    "training-blocks.training-max-input",
  );
  const estimatedOneRepMax =
    benchmark.value * benchmarkMultiplierByType[benchmark.benchmarkType];
  const trainingMax = estimatedOneRepMax * 0.9;

  return {
    liftSlug: benchmark.liftSlug,
    sourceBenchmarkType: benchmark.benchmarkType,
    sourceValue: benchmark.value,
    sourceUnit: benchmark.unit,
    estimatedOneRepMax: roundToNearestLoadIncrement(estimatedOneRepMax, benchmark.unit),
    trainingMax: roundToNearestLoadIncrement(trainingMax, benchmark.unit),
  };
};

export const deriveTrainingMaxes = (inputs: readonly BenchmarkInput[]): readonly TrainingMax[] => {
  return inputs.map((input) => deriveTrainingMaxFromBenchmark(input));
};

export type { TrainingMax };
