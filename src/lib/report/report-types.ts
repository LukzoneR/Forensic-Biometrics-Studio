import type { TFunction } from "i18next";
import type { MarkingClass } from "@/lib/markings/MarkingClass";

export type ReportT = TFunction<"report">;
export type KeywordsT = TFunction<"keywords">;

export type ImageMeta = {
    name: string;
    width: number;
    height: number;
    sizeBytes: number;
    checksum: string;
    bytes: Uint8Array;
};

export type RenderedImages = {
    originalDataUrl: string;
    allMarkingsCanvas: HTMLCanvasElement;
};

export type ReportMetadataOptions = {
    reportDateTime?: string;
    performedBy?: string;
    department?: string;
    addressLines?: string[];
};

export type ReportIdentity = {
    reportId: string;
    reportDateTime: string;
    performedBy: string;
    department: string;
    address: string[];
    appVersion: string;
};

export type ReportGenerationOptions = ReportMetadataOptions & {
    includeMatchedOnly: boolean;
    reportDateTime: string;
    reportLanguage?: string;
    performedBy: string;
    department: string;
    addressLines: string[];
    selectedLabels: number[];
};

export type Side = "top" | "bottom" | "left" | "right";

export interface Placement {
    feature: MarkingClass;
    x: number;
    y: number;
    side: Side;
}

export interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export const PAGE = {
    width: 794,
    height: 1123,
    margin: 95,
};

export const LANDSCAPE = {
    width: PAGE.height,
    height: PAGE.width,
    margin: 70,
};

export const IMAGE_CELL_SIZE = 200;
export const FULL_CIRCLE = Math.PI * 2;
export const CANVAS_CONTEXT_ERROR = "Failed to create canvas context.";
