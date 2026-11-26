import {
    createFigurePage,
    createFooter,
    createPage,
    createReportRoot,
    createStyles,
    escapeHtml,
} from "./core/dom-builder";
import { buildReportIdentity } from "./core/identity";
import { renderImageWithMarkings } from "./core/image-rendering";
import { renderPagesToPdf } from "./core/pdf-renderer";
import type {
    ImageMeta,
    ReportIdentity,
    ReportMetadataOptions,
    ReportT,
} from "./core/types";
import { getImageMeta, getSystemId } from "./core/viewport-loader";
import { generateFingerprintReportPdfWithDialog } from "./fingerprint/generate-fingerprint-report";
import type { ReportGenerationOptions } from "./fingerprint/types";
import { toDataUrl } from "./report-utils";

export type {
    ImageMeta,
    ReportIdentity,
    ReportMetadataOptions,
    ReportT,
    ReportGenerationOptions,
};

export {
    escapeHtml,
    getSystemId,
    getImageMeta,
    renderImageWithMarkings,
    createPage,
    createReportRoot,
    createStyles,
    createFooter,
    createFigurePage,
    buildReportIdentity,
    renderPagesToPdf,
    toDataUrl,
};

export const generateReportPdfWithDialog =
    generateFingerprintReportPdfWithDialog;
