import type { GeneratedTrainingPlan } from "@/features/training-blocks/schema/trainingBlockSchemas";
import { formatTrainingWeekday } from "@/features/training-blocks/services/blockSchedulingService";
import {
  getSessionKindLabel,
  getSessionStatusLabel,
} from "@/features/training-blocks/services/sessionPresentation";

export type BlockOverviewQueryModel = {
  blockId: string;
  blockName: string;
  goalSlug: string;
  startDate: string;
  endDate: string;
  durationWeeks: number | null;
  primaryGoal: string | null;
  secondaryGoal: string | null;
  trainingDaysPerWeek: number | null;
  selectedWeekdaysLabel: string | null;
  weeks: readonly {
    weekIndex: number;
    sessions: readonly {
      sessionId: string;
      title: string;
      scheduledDate: string;
      scheduledWeekdayLabel: string | null;
      sessionStatusLabel: string;
      sessionKindLabel: string;
      sessionType: string;
      status: string;
    }[];
  }[];
};

export const buildBlockOverviewQueryModel = (
  activePlan: GeneratedTrainingPlan | null,
): BlockOverviewQueryModel | null => {
  if (activePlan === null) {
    return null;
  }

  const weeksMap = new Map<
    number,
    {
      weekIndex: number;
      sessions: BlockOverviewQueryModel["weeks"][number]["sessions"];
    }
  >();

  activePlan.sessions.forEach((session) => {
    const existingWeek = weeksMap.get(session.weekIndex);
    const nextSession = {
      sessionId: session.id,
      title: session.title,
      scheduledDate: session.scheduledDate,
      scheduledWeekdayLabel: formatTrainingWeekday(session.scheduledWeekday),
      sessionStatusLabel: getSessionStatusLabel(session),
      sessionKindLabel: getSessionKindLabel(session),
      sessionType: session.sessionType,
      status: session.status,
    };

    if (existingWeek === undefined) {
      weeksMap.set(session.weekIndex, {
        weekIndex: session.weekIndex,
        sessions: [nextSession],
      });
      return;
    }

    weeksMap.set(session.weekIndex, {
      weekIndex: existingWeek.weekIndex,
      sessions: [...existingWeek.sessions, nextSession],
    });
  });

  const weeks = [...weeksMap.values()]
    .sort((left, right) => left.weekIndex - right.weekIndex)
    .map((week) => ({
      weekIndex: week.weekIndex,
      sessions: [...week.sessions].sort((left, right) =>
        left.scheduledDate.localeCompare(right.scheduledDate),
      ),
    }));
  const selectedWeekdaysLabel =
    activePlan.block.schedulingPreferences?.selectedTrainingWeekdays
      .map((weekday) => formatTrainingWeekday(weekday))
      .filter((label): label is string => label !== null)
      .join(", ") ?? null;

  return {
    blockId: activePlan.block.id,
    blockName: activePlan.block.name,
    goalSlug: activePlan.block.goalSlug,
    startDate: activePlan.block.startDate,
    endDate: activePlan.block.endDate,
    durationWeeks: activePlan.block.blockConfiguration?.durationWeeks ?? null,
    primaryGoal: activePlan.block.blockConfiguration?.primaryGoal ?? null,
    secondaryGoal: activePlan.block.blockConfiguration?.secondaryGoal ?? null,
    trainingDaysPerWeek: activePlan.block.schedulingPreferences?.trainingDaysPerWeek ?? null,
    selectedWeekdaysLabel,
    weeks,
  };
};
