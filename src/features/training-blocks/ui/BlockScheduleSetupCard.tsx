import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Card, LoadingState } from "@/components/ui";
import { useBlockSchedulingPreferencesQuery } from "@/features/training-blocks/queries/useBlockSchedulingPreferencesQuery";
import { useSaveBlockSchedulingPreferencesMutation } from "@/features/training-blocks/queries/useSaveBlockSchedulingPreferencesMutation";
import type { TrainingWeekday } from "@/features/training-blocks/schema/trainingBlockSchemas";
import {
  createBlockSchedulingDraftFromSaved,
  createEmptyBlockSchedulingDraft,
  toggleTrainingWeekday,
  validateBlockSchedulingDraft,
} from "@/features/training-blocks/services/blockSchedulingDraftService";
import {
  trainingWeekdayLabels,
  trainingWeekdayOrder,
} from "@/features/training-blocks/services/blockSchedulingService";
import { appTheme } from "@/theme/appTheme";

const frequencyOptions = [2, 3, 4, 5] as const;

export const BlockScheduleSetupCard = () => {
  const schedulingPreferencesQuery = useBlockSchedulingPreferencesQuery();
  const saveSchedulingPreferencesMutation = useSaveBlockSchedulingPreferencesMutation();
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<number>(3);
  const [selectedTrainingWeekdays, setSelectedTrainingWeekdays] = useState<readonly TrainingWeekday[]>([
    "monday",
    "wednesday",
    "friday",
  ]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [weekdayError, setWeekdayError] = useState<string | null>(null);
  const [hasHydratedSavedValues, setHasHydratedSavedValues] = useState(false);

  useEffect(() => {
    if (schedulingPreferencesQuery.data === undefined || hasHydratedSavedValues) {
      return;
    }

    const draft =
      schedulingPreferencesQuery.data === null
        ? createEmptyBlockSchedulingDraft()
        : createBlockSchedulingDraftFromSaved(schedulingPreferencesQuery.data);

    setTrainingDaysPerWeek(draft.trainingDaysPerWeek);
    setSelectedTrainingWeekdays(draft.selectedTrainingWeekdays);
    setHasHydratedSavedValues(true);
  }, [hasHydratedSavedValues, schedulingPreferencesQuery.data]);

  const handleToggleWeekday = (weekday: TrainingWeekday) => {
    setSelectedTrainingWeekdays((current) => toggleTrainingWeekday(current, weekday));
    setWeekdayError(null);
    setFeedbackMessage(null);
  };

  const handleSave = async () => {
    const validationResult = validateBlockSchedulingDraft({
      trainingDaysPerWeek,
      selectedTrainingWeekdays,
    });

    if (validationResult.data === null) {
      setWeekdayError(
        validationResult.errors.selectedTrainingWeekdays ??
          "Select the same number of weekdays as your weekly training frequency.",
      );
      setFeedbackMessage("Fix the schedule selection before saving.");
      return;
    }

    setWeekdayError(null);

    try {
      await saveSchedulingPreferencesMutation.mutateAsync(validationResult.data);
      setFeedbackMessage("Training schedule saved locally for future block generation.");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Saving the block schedule failed.",
      );
    }
  };

  if (schedulingPreferencesQuery.isLoading && !hasHydratedSavedValues) {
    return (
      <Card>
        <LoadingState
          title="Loading schedule setup"
          description="Restoring the saved weekly training frequency and weekday preferences."
        />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule setup</Text>
        <Text style={styles.description}>
          Choose how many days per week you want to train and which weekdays should receive the
          generated sessions.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Training days per week</Text>
        <View style={styles.optionRow}>
          {frequencyOptions.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => {
                setTrainingDaysPerWeek(option);
                setWeekdayError(null);
                setFeedbackMessage(null);
              }}
              style={({ pressed }) => [
                styles.choiceChip,
                trainingDaysPerWeek === option ? styles.choiceChipActive : null,
                pressed ? styles.choiceChipPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.choiceChipLabel,
                  trainingDaysPerWeek === option ? styles.choiceChipLabelActive : null,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Scheduled weekdays</Text>
        <View style={styles.optionRow}>
          {trainingWeekdayOrder.map((weekday) => {
            const isSelected = selectedTrainingWeekdays.includes(weekday);

            return (
              <Pressable
                key={weekday}
                accessibilityRole="button"
                onPress={() => {
                  handleToggleWeekday(weekday);
                }}
                style={({ pressed }) => [
                  styles.weekdayChip,
                  isSelected ? styles.weekdayChipActive : null,
                  pressed ? styles.choiceChipPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.weekdayChipLabel,
                    isSelected ? styles.choiceChipLabelActive : null,
                  ]}
                >
                  {trainingWeekdayLabels[weekday].slice(0, 3)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.helperText, weekdayError !== null ? styles.errorText : null]}>
          {weekdayError ??
            `Pick ${trainingDaysPerWeek} weekday${trainingDaysPerWeek === 1 ? "" : "s"} to match the requested weekly frequency.`}
        </Text>
      </View>

      {feedbackMessage !== null ? (
        <Text style={[styles.helperText, weekdayError !== null ? styles.errorText : null]}>
          {feedbackMessage}
        </Text>
      ) : null}

      <Button
        disabled={saveSchedulingPreferencesMutation.isPending}
        label={
          saveSchedulingPreferencesMutation.isPending
            ? "Saving schedule..."
            : "Save training schedule"
        }
        onPress={() => {
          void handleSave();
        }}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  header: {
    gap: appTheme.spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: appTheme.colors.textPrimary,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: appTheme.colors.textSecondary,
  },
  section: {
    gap: appTheme.spacing.sm,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appTheme.spacing.sm,
  },
  choiceChip: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  weekdayChip: {
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surface,
  },
  choiceChipActive: {
    borderColor: appTheme.colors.accent,
    backgroundColor: appTheme.colors.accent,
  },
  weekdayChipActive: {
    borderColor: appTheme.colors.accent,
    backgroundColor: appTheme.colors.accent,
  },
  choiceChipPressed: {
    opacity: 0.88,
  },
  choiceChipLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
  },
  weekdayChipLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: appTheme.colors.textPrimary,
    textTransform: "uppercase",
  },
  choiceChipLabelActive: {
    color: appTheme.colors.buttonText,
  },
  helperText: {
    fontSize: 13,
    color: appTheme.colors.textSecondary,
  },
  errorText: {
    color: appTheme.colors.danger,
  },
});
