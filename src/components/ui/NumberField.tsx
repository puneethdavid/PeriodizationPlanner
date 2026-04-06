import type { ComponentProps } from "react";

import { TextField } from "@/components/ui/TextField";

type NumberFieldProps = Omit<ComponentProps<typeof TextField>, "keyboardType" | "inputMode">;

export const NumberField = (props: NumberFieldProps) => {
  return <TextField inputMode="numeric" keyboardType="number-pad" {...props} />;
};
