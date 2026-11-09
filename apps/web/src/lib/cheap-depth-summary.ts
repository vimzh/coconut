import summary from "../../public/cheap-depth-scores.json";
import { parseDeepStudySummary } from "./deep-study-summary";

export const cheapDepthSummary = parseDeepStudySummary(summary);
