// These package-relative locations are identical from src modules and the bundled dist entry.
export const apiRoot = new URL("../", import.meta.url);
export const numericalServiceRoot = new URL("../../services/numerics/", apiRoot);

export function apiDataFile(relative: string): URL {
  return new URL(`data/${relative}`, apiRoot);
}
