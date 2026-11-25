import {
    createFigurePage,
    createFooter,
    createLandscapePage,
    createPage,
    createReportRoot,
    createStyles,
    escapeHtml,
    resolveFeatureTypeName,
    toCssColor,
} from "./core/dom-utils";
import { ensureImagesLoaded, renderPagesToPdf } from "./core/pdf-renderer";
import { buildReportIdentity, getSystemId } from "./core/report-identity";
import type {
    BaseReportOptions,
    Bounds,
    ImageMeta,
    Placement,
    ReportIdentity,
    ReportMetadataOptions,
    ReportT,
    Side,
} from "./core/types";
import {
    createDetailCropPairs,
    getFeatureCropCenter,
} from "./fingerprint/crop-helpers";
import { generateFingerprintReportPdf } from "./fingerprint/generate-fingerprint-report";
import type { FingerprintReportOptions } from "./fingerprint/types";
import {
    applyClustering,
    balanceSides,
    createOverviewCalloutImage,
    determineInitialSide,
    getFeatureBounds,
    getInitialPlacement,
    resolveOverlaps,
} from "./rendering/callout-placement";
import {
    cropCanvas,
    getAlignmentRotationRad,
    getExpandedCropSizeForRotation,
    getMarkingCenter,
    getMarkingDirectionRad,
    getMarkingExtent,
    normalizeAngleRad,
    rotateCanvas,
} from "./rendering/canvas-utils";
import { getImageMeta, getSpritePath } from "./rendering/image-meta";
import { renderImageWithMarkings } from "./rendering/pixi-renderer";
import { toDataUrl } from "./report-utils";

export type ReportGenerationOptions = FingerprintReportOptions;

export {
    applyClustering,
    balanceSides,
    buildReportIdentity,
    createDetailCropPairs,
    createFigurePage,
    createFooter,
    createLandscapePage,
    createOverviewCalloutImage,
    createPage,
    createReportRoot,
    createStyles,
    cropCanvas,
    determineInitialSide,
    ensureImagesLoaded,
    escapeHtml,
    generateFingerprintReportPdf,
    getAlignmentRotationRad,
    getExpandedCropSizeForRotation,
    getFeatureBounds,
    getFeatureCropCenter,
    getImageMeta,
    getInitialPlacement,
    getMarkingCenter,
    getMarkingDirectionRad,
    getMarkingExtent,
    getSpritePath,
    getSystemId,
    normalizeAngleRad,
    renderImageWithMarkings,
    renderPagesToPdf,
    resolveFeatureTypeName,
    resolveOverlaps,
    rotateCanvas,
    toCssColor,
    toDataUrl,
};

export type {
    BaseReportOptions,
    Bounds,
    FingerprintReportOptions,
    ImageMeta,
    Placement,
    ReportIdentity,
    ReportMetadataOptions,
    ReportT,
    Side,
};

export const generateReportPdfWithDialog = generateFingerprintReportPdf;
