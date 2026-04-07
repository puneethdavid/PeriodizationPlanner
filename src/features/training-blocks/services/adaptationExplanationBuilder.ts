import type {
  AdaptationEvent,
  BlockRevision,
  ExplanationRecord,
} from "@/features/training-blocks/schema/trainingBlockSchemas";
import type { ProposedPlanRevision } from "@/features/training-blocks/services/adaptationEngineContracts";

const liftDisplayNameBySlug = {
  "back-squat": "Back squat",
  "bench-press": "Bench press",
  deadlift: "Deadlift",
  "overhead-press": "Overhead press",
} as const;

const getEventType = (
  signal: ProposedPlanRevision["adaptationSignals"][number],
): AdaptationEvent["eventType"] => {
  switch (signal.signalType) {
    case "deload-needed":
      return "deload-adjustment";
    case "progression-opportunity":
    case "stalled-performance":
      return "progression-adjustment";
  }
};

const getEventHeadline = (signal: ProposedPlanRevision["adaptationSignals"][number]): string => {
  const liftName = liftDisplayNameBySlug[signal.liftSlug as keyof typeof liftDisplayNameBySlug];

  switch (signal.signalType) {
    case "progression-opportunity":
      return `${liftName} moved up for the next sessions`;
    case "stalled-performance":
      return `${liftName} is being held steady`;
    case "deload-needed":
      return `${liftName} is moving into a deload`;
  }
};

export const buildAdaptationExplanationArtifacts = (input: {
  proposedRevision: ProposedPlanRevision;
  persistedRevision: BlockRevision;
  createdAt: string;
  makeId: (prefix: string) => string;
}): {
  adaptationEvents: readonly AdaptationEvent[];
  explanationRecords: readonly ExplanationRecord[];
} => {
  const adaptationEvents = input.proposedRevision.adaptationSignals.map((signal) => ({
    id: input.makeId("adaptation_event"),
    blockId: input.proposedRevision.blockId,
    blockRevisionId: input.persistedRevision.id,
    triggeredAt: input.createdAt,
    eventType: getEventType(signal),
    reasonCode: signal.signalType,
    summary: signal.reason,
  }));

  const eventExplanationRecords = adaptationEvents.map((adaptationEvent, index) => {
    const signal = input.proposedRevision.adaptationSignals[index];

    if (signal === undefined) {
      throw new Error(
        "[adaptation-engine] Expected an adaptation signal for each persisted event.",
      );
    }

    return {
      id: input.makeId("explanation"),
      ownerType: "adaptation-event" as const,
      ownerId: adaptationEvent.id,
      createdAt: input.createdAt,
      headline: getEventHeadline(signal),
      body: signal.reason,
    };
  });

  const revisionExplanationRecord: ExplanationRecord = {
    id: input.makeId("explanation"),
    ownerType: "block-revision",
    ownerId: input.persistedRevision.id,
    createdAt: input.createdAt,
    headline: "Plan adjusted after workout feedback",
    body: input.proposedRevision.summary,
  };

  return {
    adaptationEvents,
    explanationRecords: [revisionExplanationRecord, ...eventExplanationRecords],
  };
};
