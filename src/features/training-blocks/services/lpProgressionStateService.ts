import { parseWithSchema } from "@/schema/parseWithSchema";

import {
  lpLiftProgressionStateSchema,
  lpProgramStateSchema,
  type BenchmarkInput,
  type LpLiftProgressionState,
  type LpProgramPhase,
  type LpProgramState,
  type ProgressionTier,
  type TrainingWeekday,
} from "@/features/training-blocks/schema/trainingBlockSchemas";

type LiftProgressionTierLoads = {
  minimum: number;
  medium: number;
  high: number;
};

const unitScaledIncrementTiers: Record<BenchmarkInput["unit"], LiftProgressionTierLoads> = {
  kg: {
    minimum: 0.5,
    medium: 1.25,
    high: 2.5,
  },
  lb: {
    minimum: 1.25,
    medium: 2.5,
    high: 5,
  },
};

const weekdayOrder: readonly TrainingWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const getProgressionTierIncrement = (
  unit: BenchmarkInput["unit"],
  tier: ProgressionTier,
): number => unitScaledIncrementTiers[unit][tier];

export const getUnitProgressionTiers = (
  unit: BenchmarkInput["unit"],
): LiftProgressionTierLoads => unitScaledIncrementTiers[unit];

export const roundToUnitIncrement = (
  value: number,
  unit: BenchmarkInput["unit"],
): number => {
  const increment = unitScaledIncrementTiers[unit].minimum;
  return Number((Math.round(value / increment) * increment).toFixed(2));
};

export const createInitialLpProgramState = (input: {
  blockId: string;
  programLevel: LpProgramState["programLevel"];
  currentPhase?: LpProgramPhase;
  currentMesocycleIndex?: number;
  nextCheckpointType?: LpProgramState["nextCheckpointType"];
  updatedAt: string;
}): LpProgramState =>
  parseWithSchema(
    lpProgramStateSchema,
    {
      id: `lp_program_${input.blockId}`,
      blockId: input.blockId,
      programLevel: input.programLevel,
      currentPhase: input.currentPhase ?? "volume",
      currentMesocycleIndex: input.currentMesocycleIndex ?? 1,
      nextCheckpointType: input.nextCheckpointType ?? "five-rep-max",
      activeDeloadUntilSessionIndex: null,
      lastCheckpointResultId: null,
      updatedAt: input.updatedAt,
    },
    "training-blocks.initial-lp-program-state",
  );

export const createInitialLiftProgressionStates = (input: {
  blockId: string;
  benchmarks: readonly BenchmarkInput[];
  currentPhase?: LpProgramPhase;
  updatedAt: string;
}): readonly LpLiftProgressionState[] =>
  input.benchmarks.map((benchmark) =>
    parseWithSchema(
      lpLiftProgressionStateSchema,
      {
        id: `lp_lift_${input.blockId}_${benchmark.liftSlug}`,
        blockId: input.blockId,
        liftSlug: benchmark.liftSlug,
        unit: benchmark.unit,
        currentPhase: input.currentPhase ?? "volume",
        effectiveBaselineLoad: roundToUnitIncrement(benchmark.value, benchmark.unit),
        phaseEntryLoad: roundToUnitIncrement(benchmark.value, benchmark.unit),
        currentIncrementTier: "minimum",
        lastExpectedLoad: null,
        lastLoggedLoad: null,
        lastSuccessfulLoad: roundToUnitIncrement(benchmark.value, benchmark.unit),
        consecutiveSameWeightMisses: 0,
        lastAuthoritativeWeekIndex: null,
        checkpointWorthOverperformance: false,
        updatedAt: input.updatedAt,
      },
      "training-blocks.initial-lift-progression-state",
    ),
  );

export const getExpectedWeeklyLoad = (state: LpLiftProgressionState): number =>
  roundToUnitIncrement(
    state.effectiveBaselineLoad + getProgressionTierIncrement(state.unit, state.currentIncrementTier),
    state.unit,
  );

export const getTrainingWeekdayOrderIndex = (weekday: TrainingWeekday | null): number =>
  weekday === null ? Number.MAX_SAFE_INTEGER : weekdayOrder.indexOf(weekday);

