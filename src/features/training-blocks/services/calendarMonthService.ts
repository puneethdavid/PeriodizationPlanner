export type CalendarMonthOption = {
  key: string;
  label: string;
  itemCount: number;
};

export const getCurrentMonthKey = () => new Date().toISOString().slice(0, 7);

export const formatCalendarMonthLabel = (monthKey: string) =>
  new Intl.DateTimeFormat("en-NZ", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-01T00:00:00Z`));

export const resolveRequestedMonthKey = (
  requestedMonthKey: string | null | undefined,
  availableMonthKeys: readonly string[],
  fallbackStrategy: "first" | "latest" = "first",
) => {
  if (requestedMonthKey !== null && requestedMonthKey !== undefined) {
    return availableMonthKeys.includes(requestedMonthKey)
      ? requestedMonthKey
      : (availableMonthKeys[0] ?? null);
  }

  const currentMonthKey = getCurrentMonthKey();
  if (availableMonthKeys.includes(currentMonthKey)) {
    return currentMonthKey;
  }

  if (availableMonthKeys.length === 0) {
    return null;
  }

  return fallbackStrategy === "latest"
    ? availableMonthKeys[availableMonthKeys.length - 1] ?? null
    : availableMonthKeys[0] ?? null;
};
