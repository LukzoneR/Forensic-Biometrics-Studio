import { generateShoeprintReport } from "./shoeprint/generate-shoeprint-report";
import type { ShoeprintReportGenerationOptions } from "./shoeprint/types";

export type { ShoeprintReportGenerationOptions };

export const generateShoeprintReportPdfWithDialog = generateShoeprintReport;
export { generateShoeprintReport };
