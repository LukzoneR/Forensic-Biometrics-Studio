import type { MatchedFeature } from "../core/types";

export type ReportGenerationOptions = {
    includeMatchedOnly: boolean;
    reportDateTime: string;
    reportLanguage?: string;
    performedBy: string;
    department: string;
    addressLines: string[];
    selectedLabels: number[];
};

export type FeatureCropPair = {
    left: string;
    right: string;
};

export type FeatureChunk = {
    features: MatchedFeature[];
    crops: FeatureCropPair[];
};
