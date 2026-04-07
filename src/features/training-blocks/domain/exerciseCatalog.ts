export const trackedLiftSlugs = [
  "back-squat",
  "front-squat",
  "bench-press",
  "incline-bench-press",
  "close-grip-bench-press",
  "deadlift",
  "romanian-deadlift",
  "overhead-press",
  "push-press",
  "barbell-row",
  "weighted-pull-up",
  "bulgarian-split-squat",
] as const;

export type ExerciseSlug = (typeof trackedLiftSlugs)[number];

export type ExerciseCatalogEntry = {
  slug: ExerciseSlug;
  label: string;
  shortLabel: string;
  category: "squat" | "press" | "hinge" | "pull" | "single-leg";
  benchmarkEligible: boolean;
  primaryEligible: boolean;
  secondaryEligible: boolean;
  benchmarkType: "five-rep-max" | "three-rep-max";
  benchmarkSourceSlug: ExerciseSlug;
  defaultSupportLabel?: string;
};

export const exerciseCatalog: Record<ExerciseSlug, ExerciseCatalogEntry> = {
  "back-squat": {
    slug: "back-squat",
    label: "Back squat",
    shortLabel: "Back Squat",
    category: "squat",
    benchmarkEligible: true,
    primaryEligible: true,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "back-squat",
  },
  "front-squat": {
    slug: "front-squat",
    label: "Front squat",
    shortLabel: "Front Squat",
    category: "squat",
    benchmarkEligible: true,
    primaryEligible: true,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "front-squat",
  },
  "bench-press": {
    slug: "bench-press",
    label: "Bench press",
    shortLabel: "Bench Press",
    category: "press",
    benchmarkEligible: true,
    primaryEligible: true,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "bench-press",
  },
  "incline-bench-press": {
    slug: "incline-bench-press",
    label: "Incline bench press",
    shortLabel: "Incline Bench",
    category: "press",
    benchmarkEligible: true,
    primaryEligible: true,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "incline-bench-press",
  },
  "close-grip-bench-press": {
    slug: "close-grip-bench-press",
    label: "Close-grip bench press",
    shortLabel: "Close-Grip Bench",
    category: "press",
    benchmarkEligible: false,
    primaryEligible: true,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "bench-press",
  },
  deadlift: {
    slug: "deadlift",
    label: "Deadlift",
    shortLabel: "Deadlift",
    category: "hinge",
    benchmarkEligible: true,
    primaryEligible: true,
    secondaryEligible: true,
    benchmarkType: "three-rep-max",
    benchmarkSourceSlug: "deadlift",
  },
  "romanian-deadlift": {
    slug: "romanian-deadlift",
    label: "Romanian deadlift",
    shortLabel: "Romanian Deadlift",
    category: "hinge",
    benchmarkEligible: true,
    primaryEligible: true,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "romanian-deadlift",
  },
  "overhead-press": {
    slug: "overhead-press",
    label: "Overhead press",
    shortLabel: "Overhead Press",
    category: "press",
    benchmarkEligible: true,
    primaryEligible: true,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "overhead-press",
  },
  "push-press": {
    slug: "push-press",
    label: "Push press",
    shortLabel: "Push Press",
    category: "press",
    benchmarkEligible: false,
    primaryEligible: true,
    secondaryEligible: true,
    benchmarkType: "three-rep-max",
    benchmarkSourceSlug: "overhead-press",
  },
  "barbell-row": {
    slug: "barbell-row",
    label: "Barbell row",
    shortLabel: "Barbell Row",
    category: "pull",
    benchmarkEligible: false,
    primaryEligible: false,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "bench-press",
  },
  "weighted-pull-up": {
    slug: "weighted-pull-up",
    label: "Weighted pull-up",
    shortLabel: "Weighted Pull-Up",
    category: "pull",
    benchmarkEligible: false,
    primaryEligible: false,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "bench-press",
  },
  "bulgarian-split-squat": {
    slug: "bulgarian-split-squat",
    label: "Bulgarian split squat",
    shortLabel: "Split Squat",
    category: "single-leg",
    benchmarkEligible: false,
    primaryEligible: false,
    secondaryEligible: true,
    benchmarkType: "five-rep-max",
    benchmarkSourceSlug: "back-squat",
  },
};

export const exerciseCatalogEntries = trackedLiftSlugs.map((slug) => exerciseCatalog[slug]);

export const benchmarkEligibleExerciseSlugs = exerciseCatalogEntries
  .filter((entry) => entry.benchmarkEligible)
  .map((entry) => entry.slug);

export const primaryEligibleExerciseSlugs = exerciseCatalogEntries
  .filter((entry) => entry.primaryEligible)
  .map((entry) => entry.slug);

export const secondaryEligibleExerciseSlugs = exerciseCatalogEntries
  .filter((entry) => entry.secondaryEligible)
  .map((entry) => entry.slug);

export const getExerciseLabel = (slug: ExerciseSlug): string => exerciseCatalog[slug].label;
export const getExerciseShortLabel = (slug: ExerciseSlug): string => exerciseCatalog[slug].shortLabel;
export const getBenchmarkSourceSlug = (slug: ExerciseSlug): ExerciseSlug =>
  exerciseCatalog[slug].benchmarkSourceSlug;
