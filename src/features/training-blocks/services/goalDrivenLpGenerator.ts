import { parseWithSchema } from "@/schema/parseWithSchema";

import { assertValidGeneratedTrainingPlan } from "@/features/training-blocks/domain/invariants";
import {
  exerciseCatalog,
  getBenchmarkSourceSlug,
  getExerciseShortLabel,
} from "@/features/training-blocks/domain/exerciseCatalog";
import {
  benchmarkInputSchema,
  type BlockConfiguration,
  type BenchmarkInput,
  type GeneratedTrainingPlan,
  type LpCheckpointType,
  type LpProgramPhase,
  type PlannedExercise,
  type PlannedSession,
  type PlannedSessionLpMetadata,
  type LpProgramStructure,
  type TargetLiftGoal,
  type TrainingWeekday,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import { buildLpProgramStructureFromBenchmarks } from "@/features/training-blocks/services/linearPeriodizationProgramService";
import { getUnitProgressionTiers, roundToUnitIncrement } from "@/features/training-blocks/services/lpProgressionStateService";
import { trainingWeekdayOrder } from "@/features/training-blocks/services/blockSchedulingService";

type GoalDrivenLpPhaseInstance = {
  phase: LpProgramPhase;
  durationWeeks: number;
  mesocycleIndex: number;
  checkpointType: LpCheckpointType | null;
};

type GoalDrivenLpGeneratorOptions = {
  startDate: string;
  blockName?: string;
  goalSlug?: string;
  primaryLiftSlug?: BenchmarkInput["liftSlug"];
  phaseInstancesOverride?: readonly GoalDrivenLpPhaseInstance[];
  generationVersion?: string;
};

type GoalDrivenLpGenerationInput = GoalDrivenLpGeneratorOptions & {
  blockConfiguration: BlockConfiguration;
};

type ScheduledSlot = {
  scheduledDate: string;
  scheduledWeekday: TrainingWeekday;
  weekIndex: number;
};

type ProgramWeekContext = {
  phase: LpProgramPhase;
  phaseWeekIndex: number;
  mesocycleIndex: number;
  checkpointType: LpCheckpointType | null;
  phaseInstanceIndex: number;
};

type ExerciseTemplate = {
  sets: number;
  reps: number;
  targetRpe: number | null;
  restSeconds: number;
};

const benchmarkRepsByType: Record<LpCheckpointType, number> = {
  "five-rep-max": 5,
  "three-rep-max": 3,
  "two-rep-max": 2,
};

const phaseTemplateByPhase: Record<
  Exclude<LpProgramPhase, "final-test">,
  { primary: ExerciseTemplate; secondary: ExerciseTemplate; supportLoadFactor: number }
> = {
  volume: {
    primary: { sets: 5, reps: 6, targetRpe: 7, restSeconds: 150 },
    secondary: { sets: 4, reps: 8, targetRpe: 7, restSeconds: 120 },
    supportLoadFactor: 0.92,
  },
  strength: {
    primary: { sets: 5, reps: 4, targetRpe: 8, restSeconds: 180 },
    secondary: { sets: 4, reps: 5, targetRpe: 7.5, restSeconds: 150 },
    supportLoadFactor: 0.95,
  },
  taper: {
    primary: { sets: 3, reps: 3, targetRpe: 6, restSeconds: 150 },
    secondary: { sets: 2, reps: 4, targetRpe: 6, restSeconds: 120 },
    supportLoadFactor: 0.9,
  },
};

const defaultPrimaryLiftPriority: readonly BenchmarkInput["liftSlug"][] = [
  "back-squat",
  "bench-press",
  "deadlift",
  "overhead-press",
] as const;

const kilogramsToPounds = 2.2046226218;

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getTrainingWeekdayFromIsoDate = (isoDate: string): TrainingWeekday => {
  const weekdayIndex = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
  const weekdayByJavascriptIndex: Record<number, TrainingWeekday> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  const weekday = weekdayByJavascriptIndex[weekdayIndex];

  if (weekday === undefined) {
    throw new Error(`[training-blocks.generator] Unsupported weekday index ${weekdayIndex}.`);
  }

  return weekday;
};

const hashString = (value: string): string => {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0).toString(36);
};

const makeStableId = (prefix: string, ...parts: readonly string[]): string =>
  `${prefix}_${hashString(parts.join("|"))}`;

const buildScheduledDates = (
  startDate: string,
  blockConfiguration: BlockConfiguration,
  weekCount: number,
): readonly ScheduledSlot[] => {
  const selectedWeekdays = [...blockConfiguration.schedulingPreferences.selectedTrainingWeekdays].sort(
    (left, right) => trainingWeekdayOrder.indexOf(left) - trainingWeekdayOrder.indexOf(right),
  );
  const selectedWeekdaySet = new Set(selectedWeekdays);
  const scheduledDates: ScheduledSlot[] = [];
  let cursorDate = startDate;

  while (scheduledDates.length < blockConfiguration.schedulingPreferences.trainingDaysPerWeek * weekCount) {
    const weekday = getTrainingWeekdayFromIsoDate(cursorDate);

    if (selectedWeekdaySet.has(weekday)) {
      scheduledDates.push({
        scheduledDate: cursorDate,
        scheduledWeekday: weekday,
        weekIndex:
          Math.floor(
            scheduledDates.length / blockConfiguration.schedulingPreferences.trainingDaysPerWeek,
          ) + 1,
      });
    }

    cursorDate = addDays(cursorDate, 1);
  }

  return scheduledDates;
};

const getPrimaryLiftSlug = (
  normalizedBenchmarks: readonly BenchmarkInput[],
  requestedPrimaryLiftSlug?: BenchmarkInput["liftSlug"],
): BenchmarkInput["liftSlug"] => {
  if (
    requestedPrimaryLiftSlug !== undefined &&
    normalizedBenchmarks.some((benchmark) => benchmark.liftSlug === requestedPrimaryLiftSlug)
  ) {
    return requestedPrimaryLiftSlug;
  }

  const fallbackPrimaryLiftSlug = defaultPrimaryLiftPriority.find((liftSlug) =>
    normalizedBenchmarks.some((benchmark) => benchmark.liftSlug === liftSlug),
  );

  if (fallbackPrimaryLiftSlug === undefined) {
    throw new Error("[training-blocks.generator] No supported primary lift was provided.");
  }

  return fallbackPrimaryLiftSlug;
};

const createExercise = (input: {
  sessionId: string;
  exerciseOrder: number;
  liftSlug: BenchmarkInput["liftSlug"];
  exerciseName: string;
  prescriptionKind: PlannedExercise["prescriptionKind"];
  sets: number;
  reps: number;
  targetLoad: number;
  targetRpe: number | null;
  restSeconds: number | null;
  isAmrap?: boolean;
}): PlannedExercise => {
  const plannedExerciseId = makeStableId("exercise", input.sessionId, String(input.exerciseOrder));

  return {
    id: plannedExerciseId,
    sessionId: input.sessionId,
    liftSlug: input.liftSlug,
    exerciseSlug: input.liftSlug,
    exerciseName: input.exerciseName,
    exerciseOrder: input.exerciseOrder,
    prescriptionKind: input.prescriptionKind,
    plannedSets: Array.from({ length: input.sets }, (_, setIndex) => ({
      id: makeStableId("set", plannedExerciseId, String(setIndex + 1)),
      plannedExerciseId,
      setIndex: setIndex + 1,
      targetReps: input.reps,
      targetLoad: input.targetLoad,
      targetRpe: input.targetRpe,
      restSeconds: input.restSeconds,
      tempo: null,
      isAmrap: input.isAmrap ?? false,
    })),
  };
};

const pickUniqueLiftSequence = (
  pool: readonly BenchmarkInput["liftSlug"][],
  count: number,
  startOffset: number,
  excludedLiftSlugs: readonly BenchmarkInput["liftSlug"][] = [],
): readonly BenchmarkInput["liftSlug"][] => {
  const uniquePool = pool.filter((liftSlug, index) => pool.indexOf(liftSlug) === index);
  const excluded = new Set(excludedLiftSlugs);
  const results: BenchmarkInput["liftSlug"][] = [];

  for (let offset = 0; offset < uniquePool.length && results.length < count; offset += 1) {
    const liftSlug = uniquePool[(startOffset + offset) % uniquePool.length];

    if (liftSlug === undefined || excluded.has(liftSlug) || results.includes(liftSlug)) {
      continue;
    }

    results.push(liftSlug);
  }

  return results;
};

const convertKilogramsThresholdToUnit = (
  valueInKg: number,
  unit: BenchmarkInput["unit"],
): number => (unit === "kg" ? valueInKg : Number((valueInKg * kilogramsToPounds).toFixed(2)));

const estimateAdditionalStrengthMesocycles = (input: {
  goals: readonly TargetLiftGoal[];
  benchmarks: ReadonlyMap<BenchmarkInput["liftSlug"], BenchmarkInput>;
  programStructure: LpProgramStructure;
}): number => {
  if (input.goals.length === 0) {
    return 0;
  }

  const volumeWeeks =
    input.programStructure.phases.find((phase) => phase.phase === "volume")?.durationWeeks ?? 0;
  const strengthWeeks =
    input.programStructure.phases.find((phase) => phase.phase === "strength")?.durationWeeks ?? 0;

  return input.goals.reduce((currentMax, goal) => {
    const benchmark = input.benchmarks.get(goal.liftSlug);

    if (benchmark === undefined) {
      return currentMax;
    }

    const tiers = getUnitProgressionTiers(benchmark.unit);
    const projectedSingleCycle =
      benchmark.value + volumeWeeks * tiers.minimum + strengthWeeks * tiers.medium;
    const remainingDelta = goal.targetWeight - projectedSingleCycle;

    if (remainingDelta <= 0) {
      return currentMax;
    }

    const projectedGainPerStrengthMesocycle = Math.max(tiers.medium * strengthWeeks, tiers.minimum);
    return Math.max(currentMax, Math.ceil(remainingDelta / projectedGainPerStrengthMesocycle));
  }, 0);
};

const buildPhaseInstances = (input: {
  programStructure: LpProgramStructure;
  extraStrengthMesocycles: number;
}): readonly GoalDrivenLpPhaseInstance[] => {
  const phaseInstances: GoalDrivenLpPhaseInstance[] = [];
  let strengthMesocycleIndex = 1;

  input.programStructure.phases.forEach((phase) => {
    if (phase.phase === "strength") {
      phaseInstances.push({
        phase: phase.phase,
        durationWeeks: phase.durationWeeks,
        mesocycleIndex: strengthMesocycleIndex,
        checkpointType: phase.checkpointType,
      });
      strengthMesocycleIndex += 1;

      for (let index = 0; index < input.extraStrengthMesocycles; index += 1) {
        phaseInstances.push({
          phase: "strength",
          durationWeeks: phase.durationWeeks,
          mesocycleIndex: strengthMesocycleIndex,
          checkpointType: phase.checkpointType,
        });
        strengthMesocycleIndex += 1;
      }

      return;
    }

    phaseInstances.push({
      phase: phase.phase,
      durationWeeks: phase.durationWeeks,
      mesocycleIndex: phase.phase === "volume" ? 1 : strengthMesocycleIndex,
      checkpointType: phase.checkpointType,
    });
  });

  return phaseInstances;
};

const buildProgramWeekContexts = (
  phaseInstances: readonly GoalDrivenLpPhaseInstance[],
): readonly ProgramWeekContext[] => {
  const weekContexts: ProgramWeekContext[] = [];

  phaseInstances.forEach((phaseInstance, phaseInstanceIndex) => {
    for (let phaseWeekIndex = 1; phaseWeekIndex <= phaseInstance.durationWeeks; phaseWeekIndex += 1) {
      weekContexts.push({
        phase: phaseInstance.phase,
        phaseWeekIndex,
        mesocycleIndex: phaseInstance.mesocycleIndex,
        checkpointType:
          phaseWeekIndex === phaseInstance.durationWeeks ? phaseInstance.checkpointType : null,
        phaseInstanceIndex,
      });
    }
  });

  return weekContexts;
};

const buildLiftExpectedLoadsByWeek = (input: {
  benchmarks: readonly BenchmarkInput[];
  weekContexts: readonly ProgramWeekContext[];
}): ReadonlyMap<BenchmarkInput["liftSlug"], readonly number[]> => {
  const expectedLoadsByLiftSlug = new Map<BenchmarkInput["liftSlug"], number[]>();

  input.benchmarks.forEach((benchmark) => {
    const tiers = getUnitProgressionTiers(benchmark.unit);
    let phaseEntryLoad = benchmark.value;
    let lastStrengthTopLoad = benchmark.value;
    const expectedLoads: number[] = [];

    input.weekContexts.forEach((weekContext) => {
      let expectedLoad: number;

      switch (weekContext.phase) {
        case "volume":
          expectedLoad = phaseEntryLoad + tiers.minimum * weekContext.phaseWeekIndex;
          if (weekContext.checkpointType === "five-rep-max") {
            phaseEntryLoad = expectedLoad;
          }
          break;
        case "strength":
          expectedLoad = phaseEntryLoad + tiers.medium * weekContext.phaseWeekIndex;
          lastStrengthTopLoad = expectedLoad;
          if (weekContext.checkpointType === "three-rep-max") {
            phaseEntryLoad = expectedLoad;
          }
          break;
        case "taper":
          expectedLoad = lastStrengthTopLoad * 0.9;
          break;
        case "final-test":
          expectedLoad = lastStrengthTopLoad + tiers.high;
          break;
      }

      expectedLoads.push(roundToUnitIncrement(expectedLoad, benchmark.unit));
    });

    expectedLoadsByLiftSlug.set(benchmark.liftSlug, expectedLoads);
  });

  return expectedLoadsByLiftSlug;
};

const buildLpMetadata = (input: {
  weekContext: ProgramWeekContext;
  targetLiftGoals: readonly TargetLiftGoal[];
}): PlannedSessionLpMetadata => ({
  phase: input.weekContext.phase,
  phaseWeekIndex: input.weekContext.phaseWeekIndex,
  checkpointType: input.weekContext.checkpointType,
  mesocycleIndex: input.weekContext.mesocycleIndex,
  isTaperSession: input.weekContext.phase === "taper",
  goalLiftSlugs: input.targetLiftGoals.map((goal) => goal.liftSlug),
});

const getSessionLoad = (input: {
  baseLoad: number;
  unit: BenchmarkInput["unit"];
  phase: ProgramWeekContext["phase"];
  isSupport: boolean;
}): number => {
  const phaseTemplate = input.phase === "final-test" ? null : phaseTemplateByPhase[input.phase];
  const scaledLoad = input.isSupport
    ? input.baseLoad * (phaseTemplate?.supportLoadFactor ?? 1)
    : input.baseLoad;

  return roundToUnitIncrement(scaledLoad, input.unit);
};

export const generateGoalDrivenLpTrainingBlock = (
  benchmarks: readonly BenchmarkInput[],
  options: GoalDrivenLpGenerationInput,
): GeneratedTrainingPlan => {
  const normalizedBenchmarks = benchmarks
    .map((benchmark) =>
      parseWithSchema(benchmarkInputSchema, benchmark, "training-blocks.goal-lp-generator-input"),
    )
    .sort((left, right) => left.liftSlug.localeCompare(right.liftSlug));
  const benchmarkByLiftSlug = new Map(
    normalizedBenchmarks.map((benchmark) => [benchmark.liftSlug, benchmark] as const),
  );
  const primaryLiftSlug = getPrimaryLiftSlug(normalizedBenchmarks, options.primaryLiftSlug);
  const programStructure = buildLpProgramStructureFromBenchmarks(normalizedBenchmarks);
  const extraStrengthMesocycles = estimateAdditionalStrengthMesocycles({
    goals: options.blockConfiguration.targetLiftGoals,
    benchmarks: benchmarkByLiftSlug,
    programStructure,
  });
  const phaseInstances =
    options.phaseInstancesOverride ??
    buildPhaseInstances({
      programStructure,
      extraStrengthMesocycles,
    });
  const weekContexts = buildProgramWeekContexts(phaseInstances);
  const expectedLoadsByLiftSlug = buildLiftExpectedLoadsByWeek({
    benchmarks: normalizedBenchmarks,
    weekContexts,
  });
  const scheduledDates = buildScheduledDates(
    options.startDate,
    options.blockConfiguration,
    weekContexts.length,
  );
  const planKey = [
    options.startDate,
    options.goalSlug ?? options.blockConfiguration.primaryGoal,
    primaryLiftSlug,
    programStructure.level,
    String(extraStrengthMesocycles),
    options.blockConfiguration.targetLiftGoals
      .map((goal) => `${goal.liftSlug}:${goal.targetWeight}:${goal.targetTestType}`)
      .join("|"),
    ...normalizedBenchmarks.map(
      (benchmark) =>
        `${benchmark.liftSlug}:${benchmark.benchmarkType}:${benchmark.value}:${benchmark.unit}`,
    ),
  ].join("|");
  const blockId = makeStableId("block", planKey);
  const revisionId = makeStableId("revision", planKey, "1");
  const benchmarkSnapshotId = makeStableId("benchmark_snapshot", planKey);
  const createdAt = new Date().toISOString();
  const sessions = scheduledDates.map((scheduledSlot, scheduledSlotIndex) => {
    const weekContext = weekContexts[scheduledSlot.weekIndex - 1];

    if (weekContext === undefined) {
      throw new Error(
        `[training-blocks.generator] Missing LP week context for week ${scheduledSlot.weekIndex}.`,
      );
    }

    const sessionIndex = scheduledSlotIndex + 1;
    const sessionId = makeStableId("session", planKey, String(sessionIndex));
    const isLastSessionOfWeek =
      scheduledDates[scheduledSlotIndex + 1]?.weekIndex !== scheduledSlot.weekIndex;
    const lpMetadata = buildLpMetadata({
      weekContext,
      targetLiftGoals: options.blockConfiguration.targetLiftGoals,
    });

    if (isLastSessionOfWeek && weekContext.checkpointType !== null) {
      const checkpointType = weekContext.checkpointType;
      const plannedExercises = options.blockConfiguration.benchmarkLiftSlugs.map(
        (liftSlug, exerciseIndex) => {
          const benchmark = benchmarkByLiftSlug.get(liftSlug);
          const expectedLoad = expectedLoadsByLiftSlug.get(liftSlug)?.[scheduledSlot.weekIndex - 1];

          if (benchmark === undefined || expectedLoad === undefined) {
            throw new Error(
              `[training-blocks.generator] Missing checkpoint input for ${liftSlug} in week ${scheduledSlot.weekIndex}.`,
            );
          }

        const sourceBenchmark = benchmarkByLiftSlug.get(getBenchmarkSourceSlug(liftSlug));

        if (sourceBenchmark === undefined) {
          throw new Error(
            `[training-blocks.generator] Missing source benchmark input for ${liftSlug} in week ${scheduledSlot.weekIndex}.`,
          );
        }

        return createExercise({
          sessionId,
          exerciseOrder: exerciseIndex + 1,
          liftSlug,
          exerciseName:
              weekContext.phase === "final-test"
                ? `${getExerciseShortLabel(liftSlug)} Final Evaluation`
                : `${getExerciseShortLabel(liftSlug)} Checkpoint`,
            prescriptionKind: "fixed-sets",
            sets: 1,
            reps: benchmarkRepsByType[checkpointType],
            targetLoad: expectedLoad,
            targetRpe: null,
            restSeconds: 180,
          });
        },
      );

      return {
        id: sessionId,
        blockId,
        blockRevisionId: revisionId,
        scheduledDate: scheduledSlot.scheduledDate,
        scheduledWeekday: scheduledSlot.scheduledWeekday,
        sessionIndex,
        weekIndex: scheduledSlot.weekIndex,
        sessionType: weekContext.phase === "final-test" ? ("final-test" as const) : ("benchmark" as const),
        title:
          weekContext.phase === "final-test"
            ? `Final 2RM Evaluation Week ${scheduledSlot.weekIndex}`
            : `${benchmarkRepsByType[checkpointType]}RM Checkpoint Week ${scheduledSlot.weekIndex}`,
        status: "planned" as const,
        lpMetadata,
        plannedExercises,
      } satisfies PlannedSession;
    }

    const primaryLiftSlugs = pickUniqueLiftSequence(
      options.blockConfiguration.primaryLiftPool,
      options.blockConfiguration.primaryLiftsPerSession,
      scheduledSlotIndex,
    );
    const secondaryLiftSlugs = pickUniqueLiftSequence(
      options.blockConfiguration.secondaryLiftPool,
      options.blockConfiguration.secondaryLiftsPerSession,
      scheduledSlotIndex,
      primaryLiftSlugs,
    );
    const leadLiftSlug = primaryLiftSlugs[0] ?? primaryLiftSlug;
    const sessionType =
      scheduledSlotIndex % options.blockConfiguration.schedulingPreferences.trainingDaysPerWeek === 0
        ? ("primary" as const)
        : ("secondary" as const);
    const phaseTemplate =
      weekContext.phase === "final-test"
        ? phaseTemplateByPhase.taper
        : phaseTemplateByPhase[weekContext.phase];

    const plannedExercises = [
      ...primaryLiftSlugs.map((liftSlug, exerciseIndex) => {
        const sourceLiftSlug = getBenchmarkSourceSlug(liftSlug);
        const benchmark = benchmarkByLiftSlug.get(sourceLiftSlug);
        const expectedLoad = expectedLoadsByLiftSlug.get(sourceLiftSlug)?.[scheduledSlot.weekIndex - 1];

        if (benchmark === undefined || expectedLoad === undefined) {
          throw new Error(
            `[training-blocks.generator] Missing primary lift data for ${liftSlug} in week ${scheduledSlot.weekIndex}.`,
          );
        }

        return createExercise({
          sessionId,
          exerciseOrder: exerciseIndex + 1,
          liftSlug,
          exerciseName: getExerciseShortLabel(liftSlug),
          prescriptionKind: "fixed-sets",
          sets: phaseTemplate.primary.sets,
          reps: phaseTemplate.primary.reps,
          targetLoad: getSessionLoad({
            baseLoad: expectedLoad,
            unit: benchmark.unit,
            phase: weekContext.phase,
            isSupport: false,
          }),
          targetRpe: phaseTemplate.primary.targetRpe,
          restSeconds: phaseTemplate.primary.restSeconds,
        });
      }),
      ...secondaryLiftSlugs.map((liftSlug, exerciseIndex) => {
        const sourceLiftSlug = getBenchmarkSourceSlug(liftSlug);
        const benchmark = benchmarkByLiftSlug.get(sourceLiftSlug);
        const expectedLoad = expectedLoadsByLiftSlug.get(sourceLiftSlug)?.[scheduledSlot.weekIndex - 1];

        if (benchmark === undefined || expectedLoad === undefined) {
          throw new Error(
            `[training-blocks.generator] Missing support lift data for ${liftSlug} in week ${scheduledSlot.weekIndex}.`,
          );
        }

        return createExercise({
          sessionId,
          exerciseOrder: primaryLiftSlugs.length + exerciseIndex + 1,
          liftSlug,
          exerciseName: exerciseCatalog[liftSlug].defaultSupportLabel ?? `${getExerciseShortLabel(liftSlug)} Support`,
          prescriptionKind: "fixed-sets",
          sets: phaseTemplate.secondary.sets,
          reps: phaseTemplate.secondary.reps,
          targetLoad: getSessionLoad({
            baseLoad: expectedLoad,
            unit: benchmark.unit,
            phase: weekContext.phase,
            isSupport: true,
          }),
          targetRpe: phaseTemplate.secondary.targetRpe,
          restSeconds: phaseTemplate.secondary.restSeconds,
        });
      }),
    ];

    return {
      id: sessionId,
      blockId,
      blockRevisionId: revisionId,
      scheduledDate: scheduledSlot.scheduledDate,
      scheduledWeekday: scheduledSlot.scheduledWeekday,
      sessionIndex,
      weekIndex: scheduledSlot.weekIndex,
      sessionType,
      title: `${getExerciseShortLabel(leadLiftSlug)} ${weekContext.phase === "taper" ? "Taper" : weekContext.phase === "strength" ? "Strength" : "Volume"} Week ${scheduledSlot.weekIndex}`,
      status: "planned" as const,
      lpMetadata,
      plannedExercises,
    } satisfies PlannedSession;
  });
  const lastScheduledDate = scheduledDates.at(-1)?.scheduledDate ?? addDays(options.startDate, 27);

  return assertValidGeneratedTrainingPlan({
    block: {
      id: blockId,
      name: options.blockName ?? "Linear Periodization Program",
      status: "draft",
      goalSlug: options.goalSlug ?? options.blockConfiguration.primaryGoal,
      startDate: options.startDate,
      endDate: lastScheduledDate,
      benchmarkSnapshotId,
      generationVersion: options.generationVersion ?? "v2-goal-driven-linear-periodization",
      createdAt,
      updatedAt: createdAt,
      schedulingPreferences: options.blockConfiguration.schedulingPreferences,
      blockConfiguration: options.blockConfiguration,
      notes:
        options.blockConfiguration.targetLiftGoals.length === 0
          ? `Generated a ${programStructure.level} LP program with ${phaseInstances.filter((phase) => phase.phase === "strength").length} strength mesocycle(s).`
          : `Generated a ${programStructure.level} LP program toward ${options.blockConfiguration.targetLiftGoals
              .map((goal) => `${getExerciseShortLabel(goal.liftSlug)} ${goal.targetWeight}${benchmarkByLiftSlug.get(goal.liftSlug)?.unit ?? "kg"} ${goal.targetTestType}`)
              .join(", ")} with ${phaseInstances.filter((phase) => phase.phase === "strength").length} strength mesocycle(s).`,
    },
    revision: {
      id: revisionId,
      blockId,
      revisionNumber: 1,
      reason: "initial-generation",
      summary: `Initial ${programStructure.level} LP program generated with ${phaseInstances.filter((phase) => phase.phase === "strength").length} strength mesocycle(s) toward the selected lift goals.`,
      createdAt,
    },
    sessions,
  });
};

export { buildPhaseInstances as buildGoalDrivenLpPhaseInstances };
export type { GoalDrivenLpGeneratorOptions, GoalDrivenLpPhaseInstance };
