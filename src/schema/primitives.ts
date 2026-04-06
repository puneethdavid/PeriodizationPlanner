import { z } from "zod";

export const trimmedStringSchema = z.string().trim();
export const nonEmptyStringSchema = trimmedStringSchema.min(1);
export const nullableUrlStringSchema = z
  .string()
  .trim()
  .url()
  .nullable()
  .or(z.literal(""))
  .transform((value) => {
    if (value === "" || value === null) {
      return null;
    }

    return value;
  });
export const optionalNullableStringSchema = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return value;
  });
