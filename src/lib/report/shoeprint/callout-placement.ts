import { MarkingClass } from "@/lib/markings/MarkingClass";
import {
    applyClustering,
    balanceSides,
    createOverviewCalloutImage as createOverviewCalloutImageUnified,
    determineInitialSide,
    getFeatureBounds,
    getInitialPlacement,
    resolveOverlaps,
} from "../rendering/callout-placement";

export {
    applyClustering,
    balanceSides,
    determineInitialSide,
    getFeatureBounds,
    getInitialPlacement,
    resolveOverlaps,
};

export const createOverviewCalloutImage = async (
    imageBytes: Uint8Array,
    features: MarkingClass[],
    color = "#cc0000"
): Promise<string> =>
    createOverviewCalloutImageUnified(imageBytes, features, {
        cropToBounds: false,
        color,
    });
