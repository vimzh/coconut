export const exact = (value: number | null | undefined): string =>
  value == null ? "Unavailable" : String(value);
export const shortScore = (value: number | null | undefined): string =>
  value == null ? "Unavailable" : value.toFixed(3);
export const classColors = {
  convex: "var(--chart-1)",
  concave: "var(--chart-2)",
  neither: "var(--chart-3)",
} as const;
export const classDashes = {
  convex: undefined,
  concave: "6 3",
  neither: "2 3",
} as const;
