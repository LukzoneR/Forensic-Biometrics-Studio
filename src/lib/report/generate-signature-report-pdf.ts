import { generateSignatureReport } from "./signature/generate-signature-report";
import type { SignatureReportOptions } from "./signature/types";

export type { SignatureReportOptions };

export const generateSignatureReportPdfWithDialog = generateSignatureReport;
export { generateSignatureReport };
