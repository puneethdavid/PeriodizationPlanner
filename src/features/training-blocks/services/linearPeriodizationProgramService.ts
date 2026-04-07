import type { Benchmark } from "@/features/training-blocks/schema/trainingBlockSchemas";
import type {
  LpCheckpointType,
  LpPhaseDefinition,
  LpProgramLevel,
  LpProgramStructure,
} from "@/features/training-blocks/schema/trainingBlockSchemas";

type LiftLevelThresholdBand = {
  intermediateBelow: number;
  advancedAtOrAbove: number;
};

type LiftLevelThresholdTable = Record<Benchmark["liftSlug"], LiftLevelThresholdBand>;

const kilogramThresholds: LiftLevelThresholdTable = {
  "back-squat": {
    intermediateBelow: 80,
    advancedAtOrAbove: 140,
  },
  "bench-press": {
    intermediateBelow: 60,
    advancedAtOrAbove: 100,
  },
  deadlift: {
    intermediateBelow: 100,
    advancedAtOrAbove: 180,
  },
  "overhead-press": {
    intermediateBelow: 40,
    advancedAtOrAbove: 60,
  },
};

const kilogramsToPounds = 2.2046226218;
const poundsToKilograms = 1 / kilogramsToPounds;

const phaseDurationsByLevel: Record<LpProgramLevel, { volumeWeeks: number; strengthWeeks: number }> = {
  beginner: {
    volumeWeeks: 4,
    strengthWeeks: 4,
  },
  intermediate: {
    volumeWeeks: 5,
    strengthWeeks: 5,
  },
  advanced: {
    volumeWeeks: 6,
    strengthWeeks: 6,
  },
};

const levelPriority: readonly LpProgramLevel[] = ["beginner", "intermediate", "advanced"] as const;

const normalizeBenchmarkValueToKilograms = (benchmark: Benchmark): number => {
  return benchmark.unit === "lb" ? benchmark.value * poundsToKilograms : benchmark.value;
};

const classifyLiftLevel = (benchmark: Benchmark): LpProgramLevel => {
  const thresholds = kilogramThresholds[benchmark.liftSlug];
  const normalizedValue = normalizeBenchmarkValueToKilograms(benchmark);

  if (normalizedValue >= thresholds.advancedAtOrAbove) {
    return "advanced";
  }

  if (normalizedValue < thresholds.intermediateBelow) {
    return "beginner";
  }

  return "intermediate";
};

const buildPhaseDefinition = (
  phase: LpPhaseDefinition["phase"],
  durationWeeks: number,
  checkpointType: LpCheckpointType | null,
): LpPhaseDefinition => ({
  phase,
  durationWeeks,
  checkpointType,
});

export const deriveLpProgramLevel = (benchmarks: readonly Benchmark[]): LpProgramLevel => {
  if (benchmarks.length === 0) {
    return "beginner";
  }

  const counts = benchmarks.reduce<Record<LpProgramLevel, number>>(
    (current, benchmark) => {
      const nextLevel = classifyLiftLevel(benchmark);
      return {
        ...current,
        [nextLevel]: current[nextLevel] + 1,
      };
    },
    {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
    },
  );

  return levelPriority.reduce<LpProgramLevel>((currentBest, candidate) => {
    if (counts[candidate] > counts[currentBest]) {
      return candidate;
    }

    return currentBest;
  }, "beginner");
};

export const buildLpProgramStructure = (
  level: LpProgramLevel,
): LpProgramStructure => {
  const phaseDurations = phaseDurationsByLevel[level];

  return {
    level,
    phases: [
      buildPhaseDefinition("volume", phaseDurations.volumeWeeks, "five-rep-max"),
      buildPhaseDefinition("strength", phaseDurations.strengthWeeks, "three-rep-max"),
      buildPhaseDefinition("taper", 1, null),
      buildPhaseDefinition("final-test", 1, "two-rep-max"),
    ],
  };
};

export const buildLpProgramStructureFromBenchmarks = (
  benchmarks: readonly Benchmark[],
): LpProgramStructure => {
  const level = deriveLpProgramLevel(benchmarks);
  return buildLpProgramStructure(level);
};

export const lpProgramLevelThresholds = kilogramThresholds;
