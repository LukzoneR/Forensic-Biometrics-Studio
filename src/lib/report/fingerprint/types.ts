import type { BaseReportOptions } from "../core/types";

export type FingerprintReportOptions = BaseReportOptions & {
    includeMatchedOnly: boolean;
    selectedLabels: number[];
};

export type DetailCropPair = {
    left: string;
    right: string;
};
