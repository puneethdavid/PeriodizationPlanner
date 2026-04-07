import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Button,
  Card,
  EmptyState,
  ListRow,
  LoadingState,
  NumberField,
  ScreenContainer,
} from "@/components/ui";
import { useCompletedWorkoutDetailQuery } from "@/features/training-blocks/queries/useCompletedWorkoutDetailQuery";
import { useSaveWorkoutSessionMutation } from "@/features/training-blocks/queries/useSaveWorkoutSessionMutation";
import { formatTrainingWeekday } from "@/features/training-blocks/services/blockSchedulingService";
import { getSessionKindLabel, getSessionStatusLabel } from "@/features/training-blocks/services/sessionPresentation";
import { appTheme } from "@/theme/appTheme";

type EditableSetValues = {
  reps: string;
  load: string;
  isCompleted: boolean;
};

const deriveCompletionStatus = (
  values: readonly EditableSetValues[],
): "completed" | "partial" | "missed" => {
  const completedCount = values.filter((value) => value.isCompleted).length;

  if (completedCount === 0) {
    return "missed";
  }

  if (completedCount === values.length) {
    return "completed";
  }

  return "partial";
};

const WorkoutDetailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : null;
  const workoutReviewQuery = useCompletedWorkoutDetailQuery(sessionId);
  const saveWorkoutSessionMutation = useSaveWorkoutSessionMutation(sessionId);
  const [editableSetValues, setEditableSetValues] = useState<Record<string, EditableSetValues>>({});
  const workoutReviewData = workoutReviewQuery.data;
  const loggedSetResultByPlannedSetId = useMemo(
    () =>
      new Map(
        (workoutReviewData?.loggedSetResults ?? [])
          .filter((loggedSetResult) => loggedSetResult.plannedSetId !== null)
          .map((loggedSetResult) => [loggedSetResult.plannedSetId as string, loggedSetResult] as const),
      ),
    [workoutReviewData],
  );

  useEffect(() => {
    if (workoutReviewData === null || workoutReviewData === undefined) {
      return;
    }

    const nextEditableValues: Record<string, EditableSetValues> = {};

    for (const exercise of workoutReviewData.session.plannedExercises) {
      for (const plannedSet of exercise.plannedSets) {
        const loggedSetResult = loggedSetResultByPlannedSetId.get(plannedSet.id);

        nextEditableValues[plannedSet.id] = {
          reps: String(loggedSetResult?.actualReps ?? plannedSet.targetReps),
          load: String(loggedSetResult?.actualLoad ?? plannedSet.targetLoad),
          isCompleted: loggedSetResult?.isCompleted ?? true,
        };
      }
    }

    setEditableSetValues(nextEditableValues);
  }, [loggedSetResultByPlannedSetId, workoutReviewData]);

  const allEditableValues = useMemo(
    () => Object.values(editableSetValues),
    [editableSetValues],
  );
  const completionStatus = deriveCompletionStatus(allEditableValues);
  const completedSetCount = allEditableValues.filter((value) => value.isCompleted).length;

  if (workoutReviewQuery.isLoading) {
    return (
      <ScreenContainer
        eyebrow="Workout Detail"
        title="Workout detail"
        description="Review the planned session and any logged results for the selected workout."
      >
        <Card>
          <LoadingState
            title="Loading session"
            description="Fetching the planned exercises, logged set results, and block context from local data."
          />
        </Card>
      </ScreenContainer>
    );
  }

  if (sessionId === null || workoutReviewData === null || workoutReviewData === undefined) {
    return (
      <ScreenContainer
        eyebrow="Workout Detail"
        title="Workout detail"
        description="Review the planned session and any logged results for the selected workout."
      >
        <Card>
          <EmptyState
            title="Session not found"
            description="This workout session could not be loaded from local plan data."
            action={
              <Button
                label="Back to Today"
                onPress={() => {
                  router.push("/(tabs)/today");
                }}
                variant="secondary"
              />
            }
          />
        </Card>
      </ScreenContainer>
    );
  }

  const workoutReview = workoutReviewData;
  const plannedSession = workoutReview.session;
  const workoutResult = workoutReview.workoutResult;
  const isCompleted = plannedSession.status === "completed";
  const isBenchmarkSession = plannedSession.sessionType === "benchmark";
  const isFinalTestSession = plannedSession.sessionType === "final-test";
  const isEvaluationSession = isBenchmarkSession || isFinalTestSession;
  const phaseLabel = plannedSession.lpMetadata?.phase ?? null;
  const checkpointLabel = plannedSession.lpMetadata?.checkpointType ?? null;
  const scheduledWeekdayLabel = formatTrainingWeekday(plannedSession.scheduledWeekday);
  const updateEditableSetValue = (
    plannedSetId: string,
    field: "reps" | "load" | "isCompleted",
    value: string | boolean,
  ) => {
    setEditableSetValues((current) => ({
      ...current,
      [plannedSetId]: {
        reps: current[plannedSetId]?.reps ?? "",
        load: current[plannedSetId]?.load ?? "",
        isCompleted: current[plannedSetId]?.isCompleted ?? true,
        [field]: value,
      },
    }));
  };

  const handleSaveWorkout = async () => {
    if (sessionId === null) {
      return;
    }

    await saveWorkoutSessionMutation.mutateAsync({
      sessionId,
      completionStatus,
      setResults: plannedSession.plannedExercises.flatMap((exercise) =>
        exercise.plannedSets.map((plannedSet) => {
          const adjustedValue = editableSetValues[plannedSet.id];
          const parsedReps =
            adjustedValue?.reps.trim() === undefined || adjustedValue?.reps.trim() === ""
              ? plannedSet.targetReps
              : Number(adjustedValue.reps);
          const parsedLoad =
            adjustedValue?.load.trim() === undefined || adjustedValue?.load.trim() === ""
              ? plannedSet.targetLoad
              : Number(adjustedValue.load);

          return {
            plannedSetId: plannedSet.id,
            setIndex: plannedSet.setIndex,
            actualReps: Number.isFinite(parsedReps) ? parsedReps : plannedSet.targetReps,
            actualLoad: Number.isFinite(parsedLoad) ? parsedLoad : plannedSet.targetLoad,
            actualRpe: plannedSet.targetRpe,
            isCompleted: adjustedValue?.isCompleted ?? true,
          };
        }),
      ),
    });
  };

  return (
    <ScreenContainer
      eyebrow={isEvaluationSession ? "Evaluation Session" : "Workout Detail"}
      title={plannedSession.title}
      description={
        isEvaluationSession
          ? "Benchmark and final-test sessions keep setup benchmarks, scheduled testing work, and recorded outcomes clearly separated."
          : "Review the planned session details and any recorded results for this workout."
      }
    >
      <Card>
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>
            {isBenchmarkSession
              ? isCompleted
                ? "Completed benchmark session"
                : "Benchmark test session"
              : isFinalTestSession
                ? isCompleted
                  ? "Completed final test session"
                  : "Final test session"
              : isCompleted
                ? "Completed session"
                : "Planned session"}
          </Text>
          <Text style={styles.headerDescription}>
            Session #{plannedSession.sessionIndex} for week {plannedSession.weekIndex}, scheduled on{" "}
            {plannedSession.scheduledDate}
            {scheduledWeekdayLabel === null ? "." : ` (${scheduledWeekdayLabel}).`}
          </Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Kind</Text>
            <Text style={styles.badgeValue}>{getSessionKindLabel(plannedSession)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Status</Text>
            <Text style={styles.badgeValue}>{getSessionStatusLabel(plannedSession)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Exercises</Text>
            <Text style={styles.badgeValue}>{plannedSession.plannedExercises.length}</Text>
          </View>
          {phaseLabel === null ? null : (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Phase</Text>
              <Text style={styles.badgeValue}>{phaseLabel}</Text>
            </View>
          )}
          {checkpointLabel === null ? null : (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Checkpoint</Text>
              <Text style={styles.badgeValue}>{checkpointLabel}</Text>
            </View>
          )}
          {scheduledWeekdayLabel !== null ? (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Weekday</Text>
              <Text style={styles.badgeValue}>{scheduledWeekdayLabel}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <Text style={styles.testSessionTitle}>Block context</Text>
        <Text style={styles.testSessionDescription}>
          {workoutReview.block.name}
          {workoutReview.block.status === "archived"
            ? " is archived after a later regeneration."
            : " is the current active block."}
        </Text>
        {phaseLabel === null ? null : (
          <Text style={styles.testSessionDescription}>
            This session belongs to the {phaseLabel} phase
            {checkpointLabel === null ? "." : ` and is scheduled as a ${checkpointLabel} checkpoint.`}
          </Text>
        )}
        {workoutResult !== null ? (
          <>
            <Text style={styles.testSessionTitle}>
              {isEvaluationSession ? "Recorded evaluation outcome" : "Recorded workout outcome"}
            </Text>
            <Text style={styles.testSessionDescription}>
              {workoutResult.completionStatus} on {workoutResult.completedAt.slice(0, 10)}.
              {isBenchmarkSession
                ? " This is the recorded benchmark result for the scheduled benchmark session."
                : isFinalTestSession
                  ? " This is the recorded final-test result for the scheduled final-test session."
                  : " This is the recorded result for the scheduled workout session."}
            </Text>
          </>
        ) : (
          <Text style={styles.testSessionDescription}>
            No recorded result has been saved yet for this session.
          </Text>
        )}
      </Card>

      {isEvaluationSession ? (
        <Card>
          <Text style={styles.testSessionTitle}>
            {isBenchmarkSession ? "Benchmark capture flow" : "Final test capture flow"}
          </Text>
          <Text style={styles.testSessionDescription}>
            Saved benchmark inputs are the setup values used to generate the plan. This scheduled
            session is the separate testing workout where the recorded benchmark outcome is logged.
          </Text>
        </Card>
      ) : null}

      {plannedSession.plannedExercises.map((exercise) => (
        <Card key={exercise.id}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
            <Text style={styles.exerciseMeta}>{exercise.prescriptionKind}</Text>
          </View>
          {exercise.plannedSets.map((plannedSet) => (
            <View key={plannedSet.id} style={styles.setReviewBlock}>
              <ListRow
                title={`Set ${plannedSet.setIndex}`}
                description={`Planned: ${plannedSet.targetReps} reps at ${plannedSet.targetLoad} kg`}
                trailing={
                  plannedSet.targetRpe === null
                    ? `${plannedSet.restSeconds ?? 0}s rest`
                    : `RPE ${plannedSet.targetRpe}`
                }
              />
              {isCompleted ? (
                <Text style={styles.loggedResultText}>
                  Recorded: {loggedSetResultByPlannedSetId.get(plannedSet.id)?.actualReps ?? "-"} reps
                  at {loggedSetResultByPlannedSetId.get(plannedSet.id)?.actualLoad ?? "-"} kg
                </Text>
              ) : (
                <View style={styles.inlineEditorCard}>
                  <View style={styles.inlineEditorHeader}>
                    <Text style={styles.inlineEditorTitle}>Record this set inline</Text>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: editableSetValues[plannedSet.id]?.isCompleted ?? true,
                      }}
                      onPress={() => {
                        updateEditableSetValue(
                          plannedSet.id,
                          "isCompleted",
                          !(editableSetValues[plannedSet.id]?.isCompleted ?? true),
                        );
                      }}
                      style={({ pressed }) => [
                        styles.checkbox,
                        (editableSetValues[plannedSet.id]?.isCompleted ?? true)
                          ? styles.checkboxChecked
                          : null,
                        pressed ? styles.checkboxPressed : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.checkboxLabel,
                          (editableSetValues[plannedSet.id]?.isCompleted ?? true)
                            ? styles.checkboxLabelChecked
                            : null,
                        ]}
                      >
                        {(editableSetValues[plannedSet.id]?.isCompleted ?? true) ? "Done" : "Skip"}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.inlineEditorFields}>
                    <View style={styles.inlineEditorField}>
                      <NumberField
                        helperText={`Planned reps: ${plannedSet.targetReps}`}
                        label="Actual reps"
                        onChangeText={(value) => {
                          updateEditableSetValue(plannedSet.id, "reps", value);
                        }}
                        value={editableSetValues[plannedSet.id]?.reps ?? String(plannedSet.targetReps)}
                      />
                    </View>
                    <View style={styles.inlineEditorField}>
                      <NumberField
                        helperText={`Planned load: ${plannedSet.targetLoad} kg`}
                        label={isEvaluationSession ? "Recorded load" : "Actual load"}
                        onChangeText={(value) => {
                          updateEditableSetValue(plannedSet.id, "load", value);
                        }}
                        value={editableSetValues[plannedSet.id]?.load ?? String(plannedSet.targetLoad)}
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>
      ))}

      {isCompleted ? null : (
        <Card>
          <Text style={styles.adjustedTitle}>
            {isEvaluationSession ? "Evaluation logging" : "Workout logging"}
          </Text>
          <Text style={styles.adjustedDescription}>
            {completedSetCount} of {allEditableValues.length} sets are marked done. Saving this workout
            will record it as {completionStatus}.
          </Text>
          {saveWorkoutSessionMutation.isError ? (
            <Text style={styles.errorText}>
              {saveWorkoutSessionMutation.error instanceof Error
                ? saveWorkoutSessionMutation.error.message
                : "Workout saving failed. Review the entered values and try again."}
            </Text>
          ) : null}
          <Button
            label={
              saveWorkoutSessionMutation.isPending
                ? isBenchmarkSession
                  ? "Saving benchmark result..."
                  : isFinalTestSession
                    ? "Saving final test result..."
                    : "Saving workout..."
                : isBenchmarkSession
                  ? "Save benchmark result"
                  : isFinalTestSession
                    ? "Save final test result"
                    : "Save workout"
            }
            onPress={() => {
              void handleSaveWorkout();
            }}
          />
        </Card>
      )}
      <Card>
        <Button
          label={workoutReview.block.status === "archived" ? "Back to History" : "Back to Today"}
          onPress={() => {
            router.push(
              workoutReview.block.status === "archived" ? "/(tabs)/history" : "/(tabs)/today",
            );
          }}
          variant="secondary"
        />
        <Button
          label="Back to full plan"
          onPress={() => {
            router.push("/plan");
          }}
          variant="secondary"
        />
      </Card>
    </ScreenContainer>
  );
};

export default WorkoutDetailScreen;

const styles = StyleSheet.create({
  header: {
    gap: appTheme.spacing.xs,
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: appTheme.colors.accent,
  },
  headerDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: appTheme.colors.textSecondary,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appTheme.spacing.sm,
  },
  badge: {
    minWidth: 96,
    gap: 4,
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appTheme.colors.textMuted,
  },
  badgeValue: {
    fontSize: 14,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  exerciseHeader: {
    gap: 4,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  exerciseMeta: {
    fontSize: 13,
    color: appTheme.colors.textSecondary,
    textTransform: "capitalize",
  },
  setReviewBlock: {
    gap: 6,
  },
  loggedResultText: {
    fontSize: 13,
    lineHeight: 20,
    color: appTheme.colors.textSecondary,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: appTheme.colors.danger,
  },
  adjustedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  adjustedDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: appTheme.colors.textSecondary,
  },
  inlineEditorCard: {
    gap: appTheme.spacing.sm,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: appTheme.radius.md,
    padding: appTheme.spacing.md,
    backgroundColor: appTheme.colors.surface,
  },
  inlineEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appTheme.spacing.md,
  },
  inlineEditorTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  inlineEditorFields: {
    flexDirection: "row",
    gap: appTheme.spacing.sm,
  },
  inlineEditorField: {
    flex: 1,
  },
  checkbox: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  checkboxChecked: {
    backgroundColor: appTheme.colors.accent,
    borderColor: appTheme.colors.accent,
  },
  checkboxPressed: {
    opacity: 0.9,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  checkboxLabelChecked: {
    color: appTheme.colors.buttonText,
  },
  testSessionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  testSessionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: appTheme.colors.textSecondary,
  },
});
