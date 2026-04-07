import type {
  BenchmarkInput,
  GeneratedTrainingPlan,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import { createDefaultBlockSchedulingPreferences } from "@/features/training-blocks/services/blockSchedulingService";
import { generateFixedTrainingBlock } from "@/features/training-blocks/services/fixedBlockGenerator";

export const starterBenchmarkFixture: readonly BenchmarkInput[] = [
  {
    liftSlug: "back-squat",
    benchmarkType: "five-rep-max",
    value: 140,
    unit: "kg",
    capturedAt: "2026-04-07T00:00:00.000Z",
    notes: "Comfortable final rep.",
  },
  {
    liftSlug: "bench-press",
    benchmarkType: "five-rep-max",
    value: 100,
    unit: "kg",
    capturedAt: "2026-04-07T00:00:00.000Z",
    notes: null,
  },
  {
    liftSlug: "deadlift",
    benchmarkType: "three-rep-max",
    value: 180,
    unit: "kg",
    capturedAt: "2026-04-07T00:00:00.000Z",
    notes: null,
  },
  {
    liftSlug: "overhead-press",
    benchmarkType: "five-rep-max",
    value: 62.5,
    unit: "kg",
    capturedAt: "2026-04-07T00:00:00.000Z",
    notes: null,
  },
] as const;

export const trainingFixtureStrategy = {
  seedName: "starter-benchmark-block",
  description:
    "Seed benchmark inputs first, then generate a deterministic 4-week block from those saved values.",
  steps: [
    "Insert or upsert one benchmark per supported primary lift.",
    "Create a benchmark snapshot at generation time instead of pointing blocks directly at mutable benchmark rows.",
    "Persist the generated block, revision, sessions, exercises, and sets in one transaction.",
  ],
} as const;

export const createStarterTrainingPlanFixture = (
  startDate = "2026-04-13",
): GeneratedTrainingPlan => {
  return generateFixedTrainingBlock(starterBenchmarkFixture, {
    startDate,
    blockName: "Starter Strength Block",
    goalSlug: "general-strength",
    primaryLiftSlug: "back-squat",
    schedulingPreferences: createDefaultBlockSchedulingPreferences(),
  });
};
