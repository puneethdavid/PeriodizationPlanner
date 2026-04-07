import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Card, LoadingState } from "@/components/ui";
import { benchmarkFieldMetadata } from "@/features/training-blocks/services/benchmarkDraftService";
import { useBlockConfigurationQuery } from "@/features/training-blocks/queries/useBlockConfigurationQuery";
import { useSaveBlockConfigurationMutation } from "@/features/training-blocks/queries/useSaveBlockConfigurationMutation";
import type { BenchmarkInput, TrainingWeekday } from "@/features/training-blocks/schema/trainingBlockSchemas";
import {
  createBlockConfigurationDraftFromSaved,
  createEmptyBlockConfigurationDraft,
  toggleLiftSlugSelection,
  toggleTrainingWeekday,
  validateBlockConfigurationDraft,
} from "@/features/training-blocks/services/blockConfigurationDraftService";
import {
  blockDurationWeekOptions,
  liftGoalLabels,
  liftGoalOptions,
  sessionPrimaryLiftCountOptions,
  sessionSecondaryLiftCountOptions,
} from "@/features/training-blocks/services/blockConfigurationService";
import { trainingWeekdayLabels, trainingWeekdayOrder } from "@/features/training-blocks/services/blockSchedulingService";
import { appTheme } from "@/theme/appTheme";

const frequencyOptions = [2, 3, 4, 5] as const;
const liftOptions = Object.keys(benchmarkFieldMetadata) as BenchmarkInput["liftSlug"][];

export const BlockScheduleSetupCard = () => {
  const blockConfigurationQuery = useBlockConfigurationQuery();
  const saveBlockConfigurationMutation = useSaveBlockConfigurationMutation();
  const [draft, setDraft] = useState(createEmptyBlockConfigurationDraft);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasHydratedSavedValues, setHasHydratedSavedValues] = useState(false);

  useEffect(() => {
    if (blockConfigurationQuery.data === undefined || hasHydratedSavedValues) {
      return;
    }

    setDraft(
      blockConfigurationQuery.data === null
        ? createEmptyBlockConfigurationDraft()
        : createBlockConfigurationDraftFromSaved(blockConfigurationQuery.data),
    );
    setHasHydratedSavedValues(true);
  }, [blockConfigurationQuery.data, hasHydratedSavedValues]);

  const handleToggleWeekday = (weekday: TrainingWeekday) => {
    setDraft((current) => ({
      ...current,
        schedulingPreferences: {
          ...current.schedulingPreferences,
          selectedTrainingWeekdays: [
            ...toggleTrainingWeekday(current.schedulingPreferences.selectedTrainingWeekdays, weekday),
          ],
        },
      }));
    setErrorMessage(null);
    setFeedbackMessage(null);
  };

  const handleToggleLift = (
    key: "benchmarkLiftSlugs" | "primaryLiftPool" | "secondaryLiftPool",
    liftSlug: BenchmarkInput["liftSlug"],
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: toggleLiftSlugSelection(current[key], liftSlug),
    }));
    setErrorMessage(null);
    setFeedbackMessage(null);
  };

  const handleSave = async () => {
    const validationResult = validateBlockConfigurationDraft(draft);

    if (validationResult.data === null) {
      const nextErrorMessage =
        validationResult.errors.schedulingPreferences ??
        "Fix the highlighted block configuration fields before saving.";
      setErrorMessage(nextErrorMessage);
      setFeedbackMessage("The block configuration needs one more pass before it can be saved.");
      return;
    }

    setErrorMessage(null);

    try {
      await saveBlockConfigurationMutation.mutateAsync(validationResult.data);
      setFeedbackMessage("Block configuration saved locally and ready for generation.");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Saving the block configuration failed.",
      );
    }
  };

  if (blockConfigurationQuery.isLoading && !hasHydratedSavedValues) {
    return (
      <Card>
        <LoadingState
          title="Loading block setup"
          description="Restoring the saved schedule, goals, duration, and lift selections."
        />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Block setup</Text>
        <Text style={styles.description}>
          Configure the weekly schedule, duration, goals, benchmark lifts, and session composition
          before generating or regenerating the active block.
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
                setDraft((current) => ({
                  ...current,
                  schedulingPreferences: {
                    ...current.schedulingPreferences,
                    trainingDaysPerWeek: option,
                  },
                }));
                setErrorMessage(null);
                setFeedbackMessage(null);
              }}
              style={({ pressed }) => [
                styles.choiceChip,
                draft.schedulingPreferences.trainingDaysPerWeek === option
                  ? styles.choiceChipActive
                  : null,
                pressed ? styles.choiceChipPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.choiceChipLabel,
                  draft.schedulingPreferences.trainingDaysPerWeek === option
                    ? styles.choiceChipLabelActive
                    : null,
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
            const isSelected = draft.schedulingPreferences.selectedTrainingWeekdays.includes(weekday);

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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Block duration</Text>
        <View style={styles.optionRow}>
          {blockDurationWeekOptions.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => {
                setDraft((current) => ({
                  ...current,
                  durationWeeks: option,
                }));
                setErrorMessage(null);
                setFeedbackMessage(null);
              }}
              style={({ pressed }) => [
                styles.choiceChip,
                draft.durationWeeks === option ? styles.choiceChipActive : null,
                pressed ? styles.choiceChipPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.choiceChipLabel,
                  draft.durationWeeks === option ? styles.choiceChipLabelActive : null,
                ]}
              >
                {option}w
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Primary goal</Text>
        <View style={styles.optionRow}>
          {liftGoalOptions.map((goal) => (
            <Pressable
              key={goal}
              accessibilityRole="button"
              onPress={() => {
                setDraft((current) => ({
                  ...current,
                  primaryGoal: goal,
                }));
                setErrorMessage(null);
                setFeedbackMessage(null);
              }}
              style={({ pressed }) => [
                styles.choiceChip,
                draft.primaryGoal === goal ? styles.choiceChipActive : null,
                pressed ? styles.choiceChipPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.choiceChipLabel,
                  draft.primaryGoal === goal ? styles.choiceChipLabelActive : null,
                ]}
              >
                {liftGoalLabels[goal]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Secondary goal</Text>
        <View style={styles.optionRow}>
          {liftGoalOptions.map((goal) => (
            <Pressable
              key={goal}
              accessibilityRole="button"
              onPress={() => {
                setDraft((current) => ({
                  ...current,
                  secondaryGoal: goal,
                }));
                setErrorMessage(null);
                setFeedbackMessage(null);
              }}
              style={({ pressed }) => [
                styles.choiceChip,
                draft.secondaryGoal === goal ? styles.choiceChipActive : null,
                pressed ? styles.choiceChipPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.choiceChipLabel,
                  draft.secondaryGoal === goal ? styles.choiceChipLabelActive : null,
                ]}
              >
                {liftGoalLabels[goal]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Benchmark lifts</Text>
        <View style={styles.optionRow}>
          {liftOptions.map((liftSlug) => {
            const isSelected = draft.benchmarkLiftSlugs.includes(liftSlug);

            return (
              <Pressable
                key={`benchmark-${liftSlug}`}
                accessibilityRole="button"
                onPress={() => {
                  handleToggleLift("benchmarkLiftSlugs", liftSlug);
                }}
                style={({ pressed }) => [
                  styles.liftChip,
                  isSelected ? styles.choiceChipActive : null,
                  pressed ? styles.choiceChipPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.choiceChipLabel,
                    isSelected ? styles.choiceChipLabelActive : null,
                  ]}
                >
                  {benchmarkFieldMetadata[liftSlug].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Primary lifts per session</Text>
        <View style={styles.optionRow}>
          {sessionPrimaryLiftCountOptions.map((option) => (
            <Pressable
              key={`primary-count-${option}`}
              accessibilityRole="button"
              onPress={() => {
                setDraft((current) => ({
                  ...current,
                  primaryLiftsPerSession: option,
                }));
                setErrorMessage(null);
                setFeedbackMessage(null);
              }}
              style={({ pressed }) => [
                styles.choiceChip,
                draft.primaryLiftsPerSession === option ? styles.choiceChipActive : null,
                pressed ? styles.choiceChipPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.choiceChipLabel,
                  draft.primaryLiftsPerSession === option ? styles.choiceChipLabelActive : null,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Secondary lifts per session</Text>
        <View style={styles.optionRow}>
          {sessionSecondaryLiftCountOptions.map((option) => (
            <Pressable
              key={`secondary-count-${option}`}
              accessibilityRole="button"
              onPress={() => {
                setDraft((current) => ({
                  ...current,
                  secondaryLiftsPerSession: option,
                }));
                setErrorMessage(null);
                setFeedbackMessage(null);
              }}
              style={({ pressed }) => [
                styles.choiceChip,
                draft.secondaryLiftsPerSession === option ? styles.choiceChipActive : null,
                pressed ? styles.choiceChipPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.choiceChipLabel,
                  draft.secondaryLiftsPerSession === option ? styles.choiceChipLabelActive : null,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Primary lift pool</Text>
        <View style={styles.optionRow}>
          {liftOptions.map((liftSlug) => {
            const isSelected = draft.primaryLiftPool.includes(liftSlug);

            return (
              <Pressable
                key={`primary-pool-${liftSlug}`}
                accessibilityRole="button"
                onPress={() => {
                  handleToggleLift("primaryLiftPool", liftSlug);
                }}
                style={({ pressed }) => [
                  styles.liftChip,
                  isSelected ? styles.choiceChipActive : null,
                  pressed ? styles.choiceChipPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.choiceChipLabel,
                    isSelected ? styles.choiceChipLabelActive : null,
                  ]}
                >
                  {benchmarkFieldMetadata[liftSlug].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Secondary lift pool</Text>
        <View style={styles.optionRow}>
          {liftOptions.map((liftSlug) => {
            const isSelected = draft.secondaryLiftPool.includes(liftSlug);

            return (
              <Pressable
                key={`secondary-pool-${liftSlug}`}
                accessibilityRole="button"
                onPress={() => {
                  handleToggleLift("secondaryLiftPool", liftSlug);
                }}
                style={({ pressed }) => [
                  styles.liftChip,
                  isSelected ? styles.choiceChipActive : null,
                  pressed ? styles.choiceChipPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.choiceChipLabel,
                    isSelected ? styles.choiceChipLabelActive : null,
                  ]}
                >
                  {benchmarkFieldMetadata[liftSlug].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {errorMessage !== null ? (
        <Text style={[styles.helperText, styles.errorText]}>{errorMessage}</Text>
      ) : null}
      {feedbackMessage !== null ? (
        <Text style={styles.helperText}>{feedbackMessage}</Text>
      ) : null}

      <Button
        disabled={saveBlockConfigurationMutation.isPending}
        label={
          saveBlockConfigurationMutation.isPending
            ? "Saving block setup..."
            : "Save block setup"
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
  liftChip: {
    minWidth: 132,
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
    lineHeight: 20,
  },
  errorText: {
    color: appTheme.colors.danger,
  },
});
