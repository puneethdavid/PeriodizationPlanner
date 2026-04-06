import { useEffect, useState } from "react";

import { StyleSheet, Text, View } from "react-native";

import { Button, Card, LoadingState, NumberField } from "@/components/ui";
import { useBenchmarksQuery } from "@/features/training-blocks/queries/useBenchmarksQuery";
import { useSaveBenchmarksMutation } from "@/features/training-blocks/queries/useSaveBenchmarksMutation";
import {
  benchmarkFieldMetadata,
  createBenchmarkDraftsFromSaved,
  createEmptyBenchmarkDrafts,
  type BenchmarkDraftErrors,
  type BenchmarkDraftValues,
  validateBenchmarkDrafts,
} from "@/features/training-blocks/services/benchmarkDraftService";
import { appTheme } from "@/theme/appTheme";

export const BenchmarkEntryCard = () => {
  const benchmarksQuery = useBenchmarksQuery();
  const saveBenchmarksMutation = useSaveBenchmarksMutation();
  const [drafts, setDrafts] = useState<BenchmarkDraftValues>(createEmptyBenchmarkDrafts);
  const [errors, setErrors] = useState<BenchmarkDraftErrors>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [hasHydratedSavedValues, setHasHydratedSavedValues] = useState(false);

  useEffect(() => {
    if (benchmarksQuery.data === undefined || hasHydratedSavedValues) {
      return;
    }

    setDrafts(createBenchmarkDraftsFromSaved(benchmarksQuery.data));
    setHasHydratedSavedValues(true);
  }, [benchmarksQuery.data, hasHydratedSavedValues]);

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
    const validationResult = validateBenchmarkDrafts(drafts);

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

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Benchmark setup</Text>
        <Text style={styles.description}>
          Save the current starting benchmarks for the core lifts before generating a block.
        </Text>
      </View>
      {Object.entries(benchmarkFieldMetadata).map(([liftSlug, metadata]) => (
        <NumberField
          key={liftSlug}
          helperText={errors[liftSlug as keyof BenchmarkDraftValues] ?? metadata.helperText}
          label={metadata.label}
          onChangeText={(value) => updateDraft(liftSlug as keyof BenchmarkDraftValues, value)}
          placeholder="0"
          value={drafts[liftSlug as keyof BenchmarkDraftValues]}
        />
      ))}
      {feedbackMessage !== null ? (
        <Text style={[styles.feedback, Object.keys(errors).length > 0 ? styles.error : null]}>
          {feedbackMessage}
        </Text>
      ) : null}
      <Button
        disabled={saveBenchmarksMutation.isPending}
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
