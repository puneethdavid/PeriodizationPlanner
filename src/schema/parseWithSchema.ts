import type { ZodType } from "zod";

export const parseWithSchema = <TOutput>(
  schema: ZodType<TOutput>,
  input: unknown,
  boundaryName: string,
): TOutput => {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  throw new Error(`[${boundaryName}] ${details}`);
};
