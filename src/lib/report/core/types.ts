import type { TFunction } from "i18next";
import { MarkingClass } from "@/lib/markings/MarkingClass";

export type BaseReportOptions = {
    reportDateTime: string;
    reportLanguage?: string;
    performedBy: string;
    department: string;
    addressLines: string[];
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

export type ImageMeta = {
    name: string;
    width: number;
    height: number;
    sizeBytes: number;
    checksum: string;
    bytes: Uint8Array;
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

export type ReportT = TFunction<"report">;
export type KeywordsT = TFunction<"keywords">;
