import type {
    Bounds,
    ImageMeta,
    MatchedFeature,
    Placement,
    Side,
} from "../core/types";
import {
    CANVAS_CONTEXT_ERROR,
    FULL_CIRCLE,
    IMAGE_CELL_SIZE,
    LANDSCAPE,
    PAGE,
} from "../core/types";

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

export type PairedFeature = MatchedFeature;

export type { Side, Placement, Bounds, ImageMeta };
export { PAGE, LANDSCAPE, IMAGE_CELL_SIZE, FULL_CIRCLE, CANVAS_CONTEXT_ERROR };

export const UNIQUE_ROWS_PER_PAGE = 2;
export const PREFIX_PATTERN = "P:";
export const PREFIX_GROUP = "G:";
export const PREFIX_UNIQUE = "U:";
export const OVERVIEW_CHUNK_SIZE = 32;
