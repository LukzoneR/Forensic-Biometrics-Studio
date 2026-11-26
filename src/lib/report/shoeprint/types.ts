import { MarkingClass } from "@/lib/markings/MarkingClass";
import {
    Bounds,
    CANVAS_CONTEXT_ERROR,
    FULL_CIRCLE,
    IMAGE_CELL_SIZE,
    ImageMeta,
    LANDSCAPE,
    PAGE,
    Placement,
    Side,
} from "../report-types";

export type ShoeprintReportGenerationOptions = {
    reportDateTime: string;
    reportLanguage?: string;
    performedBy: string;
    department: string;
    addressLines: string[];
    uniqueColor?: "red" | "green";
    reportTitle?: string;
    includeComparison?: boolean;
};

export type PairedFeature = {
    id: string;
    left: MarkingClass;
    right: MarkingClass;
};

export {
    type Bounds,
    CANVAS_CONTEXT_ERROR,
    FULL_CIRCLE,
    IMAGE_CELL_SIZE,
    type ImageMeta,
    LANDSCAPE,
    PAGE,
    type Placement,
    type Side,
};

export const UNIQUE_ROWS_PER_PAGE = 2;
export const PREFIX_PATTERN = "P:";
export const PREFIX_GROUP = "G:";
export const PREFIX_UNIQUE = "U:";
export const OVERVIEW_CHUNK_SIZE = 32;
