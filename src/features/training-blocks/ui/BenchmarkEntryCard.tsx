import { useEffect, useState } from "react";

import { StyleSheet, Text, View } from "react-native";

import { Button, Card, LoadingState, NumberField } from "@/components/ui";
import { benchmarkEligibleExerciseSlugs, getExerciseLabel } from "@/features/training-blocks/domain/exerciseCatalog";
import { useBenchmarksQuery } from "@/features/training-blocks/queries/useBenchmarksQuery";
import { useBlockConfigurationQuery } from "@/features/training-blocks/queries/useBlockConfigurationQuery";
import { useSaveBenchmarksMutation } from "@/features/training-blocks/queries/useSaveBenchmarksMutation";
import {
  createBenchmarkDraftsFromSaved,
  createEmptyBenchmarkDrafts,
  type BenchmarkDraftErrors,
  type BenchmarkDraftValues,
  benchmarkFieldMetadata,
  validateBenchmarkDrafts,
} from "@/features/training-blocks/services/benchmarkDraftService";
import { appTheme } from "@/theme/appTheme";

export const BenchmarkEntryCard = () => {
  const benchmarksQuery = useBenchmarksQuery();
  const blockConfigurationQuery = useBlockConfigurationQuery();
  const saveBenchmarksMutation = useSaveBenchmarksMutation();
  const [drafts, setDrafts] = useState<BenchmarkDraftValues>(createEmptyBenchmarkDrafts);
  const [errors, setErrors] = useState<BenchmarkDraftErrors>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [hasHydratedSavedValues, setHasHydratedSavedValues] = useState(false);

  useEffect(() => {
    const selectedBenchmarkLifts =
      blockConfigurationQuery.data?.benchmarkLiftSlugs ?? benchmarkEligibleExerciseSlugs;

    if (benchmarksQuery.data === undefined || hasHydratedSavedValues) {
      return;
    }

    setDrafts(createBenchmarkDraftsFromSaved(benchmarksQuery.data, selectedBenchmarkLifts));
    setHasHydratedSavedValues(true);
  }, [benchmarksQuery.data, blockConfigurationQuery.data, hasHydratedSavedValues]);

  const updateDraft = (liftSlug: keyof BenchmarkDraftValues, value: string) => {
    setDrafts((current) => ({
      ...current,
      [liftSlug]: value,
    }));

    setErrors((current) => {
      if (current[liftSlug] === undefined) {
        return current;
      }

      return {
        ...current,
        [liftSlug]: undefined,
      };
    });
    setFeedbackMessage(null);
  };

  const handleSave = async () => {
    const selectedBenchmarkLifts =
      blockConfigurationQuery.data?.benchmarkLiftSlugs ?? benchmarkEligibleExerciseSlugs;
    const validationResult = validateBenchmarkDrafts(drafts, selectedBenchmarkLifts);

    if (Object.keys(validationResult.errors).length > 0) {
      setErrors(validationResult.errors);
      setFeedbackMessage("Fix the highlighted benchmark fields before saving.");
      return;
    }

    setErrors({});

    try {
      await saveBenchmarksMutation.mutateAsync(validationResult.inputs);
      setFeedbackMessage("Benchmarks saved locally and ready for block generation.");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error
          ? error.message
          : "Saving benchmarks failed. Try again after checking local database setup.",
      );
    }
  };

  if (benchmarksQuery.isLoading && !hasHydratedSavedValues) {
    return (
      <Card>
        <LoadingState
          title="Loading saved benchmarks"
          description="Checking local benchmark values so the form can restore your last saved inputs."
        />
      </Card>
    );
  }

  const selectedBenchmarkLifts =
    blockConfigurationQuery.data?.benchmarkLiftSlugs ?? benchmarkEligibleExerciseSlugs;

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Benchmark setup</Text>
        <Text style={styles.description}>
          Save the starting benchmark inputs for the selected benchmark-capable primary lifts before
          generating a block. These setup values stay separate from later benchmark or final-test
          workout results logged inside the program.
        </Text>
      </View>
      <Text style={styles.feedback}>
        {selectedBenchmarkLifts.length === 0
          ? "No benchmark lifts are selected yet."
          : `${selectedBenchmarkLifts.length} selected benchmark lift${selectedBenchmarkLifts.length === 1 ? "" : "s"} will be used for generation.`}
      </Text>
      {selectedBenchmarkLifts.length === 0 ? (
        <Text style={styles.feedback}>
          Select benchmark-capable primary lifts in Block setup first, then their benchmark inputs
          will appear here.
        </Text>
      ) : null}
      {selectedBenchmarkLifts.map((liftSlug) => (
        <NumberField
          key={liftSlug}
          helperText={errors[liftSlug] ?? benchmarkFieldMetadata[liftSlug].helperText}
          label={getExerciseLabel(liftSlug)}
          onChangeText={(value) => updateDraft(liftSlug, value)}
          placeholder="0"
          value={drafts[liftSlug] ?? ""}
        />
      ))}
      {feedbackMessage !== null ? (
        <Text style={[styles.feedback, Object.keys(errors).length > 0 ? styles.error : null]}>
          {feedbackMessage}
        </Text>
      ) : null}
      <Button
        disabled={saveBenchmarksMutation.isPending || selectedBenchmarkLifts.length === 0}
        label={saveBenchmarksMutation.isPending ? "Saving benchmarks..." : "Save benchmarks"}
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
  feedback: {
    fontSize: 13,
    color: appTheme.colors.textSecondary,
  },
  error: {
    color: appTheme.colors.danger,
  },
});
