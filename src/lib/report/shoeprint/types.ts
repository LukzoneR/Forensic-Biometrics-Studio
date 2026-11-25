import { MarkingClass } from "@/lib/markings/MarkingClass";
import type {
    BaseReportOptions,
    Bounds,
    ImageMeta,
    Placement,
    Side,
} from "../core/types";

export type ShoeprintReportGenerationOptions = BaseReportOptions & {
    uniqueColor?: "red" | "green";
    reportTitle?: string;
    includeComparison?: boolean;
};

export type PairedFeature = {
    id: string;
    left: MarkingClass;
    right: MarkingClass;
};

export type { Bounds, ImageMeta, Placement, Side };

export {
    CANVAS_CONTEXT_ERROR,
    FULL_CIRCLE,
    IMAGE_CELL_SIZE,
    LANDSCAPE,
    PAGE,
} from "../core/constants";

export const UNIQUE_ROWS_PER_PAGE = 2;
export const PREFIX_PATTERN = "P:";
export const PREFIX_GROUP = "G:";
export const PREFIX_UNIQUE = "U:";
export const OVERVIEW_CHUNK_SIZE = 32;
