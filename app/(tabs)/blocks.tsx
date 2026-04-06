import { useState } from "react";

import { Button, Card, NumberField, ScreenContainer, TextField } from "@/components/ui";

const BlocksScreen = () => {
  const [blockName, setBlockName] = useState("Strength base");
  const [weeks, setWeeks] = useState("4");

  return (
    <ScreenContainer
      eyebrow="Planning"
      title="Blocks"
      description="Training blocks, phase structure, and progression controls will expand from this route."
    >
      <Card>
        <TextField
          helperText="Example shared text input for block naming and future plan setup."
          label="Block name"
          onChangeText={setBlockName}
          value={blockName}
        />
        <NumberField
          helperText="Example numeric input for cycle length, targets, or session counts."
          label="Weeks"
          onChangeText={setWeeks}
          value={weeks}
        />
        <Button label="Save draft block" variant="secondary" />
      </Card>
    </ScreenContainer>
  );
};

export default BlocksScreen;
