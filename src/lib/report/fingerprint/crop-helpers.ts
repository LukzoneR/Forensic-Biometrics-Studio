import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import { IMAGE_CELL_SIZE, RAY_LINE_LENGTH_MULTIPLIER } from "../core/constants";
import type { ImageMeta } from "../core/types";
import {
    cropCanvas,
    getAlignmentRotationRad,
    getExpandedCropSizeForRotation,
    getMarkingDirectionRad,
    rotateCanvas,
} from "../rendering/canvas-utils";
import { renderImageWithMarkings } from "../rendering/pixi-renderer";
import type { MatchedFeature } from "../report-utils";
import type { DetailCropPair } from "./types";

export const getFeatureCropCenter = (
    marking: MarkingClass,
    markingType: MarkingType | undefined,
    sizeScale: number
): { x: number; y: number } => {
    const withEndpoint = marking as MarkingClass & {
        endpoint?: { x: number; y: number };
    };

    if (
        withEndpoint.endpoint &&
        Number.isFinite(withEndpoint.endpoint.x) &&
        Number.isFinite(withEndpoint.endpoint.y)
    ) {
        return {
            x: (marking.origin.x + withEndpoint.endpoint.x) / 2,
            y: (marking.origin.y + withEndpoint.endpoint.y) / 2,
        };
    }

    if (marking.markingClass === MARKING_CLASS.RAY) {
        const direction = getMarkingDirectionRad(marking);
        if (direction !== null) {
            const scaledSize = Math.max(
                2,
                (markingType?.size ?? 10) * sizeScale
            );
            const rayLength = RAY_LINE_LENGTH_MULTIPLIER * scaledSize;
            return {
                x: marking.origin.x + (-Math.sin(direction) * rayLength) / 2,
                y: marking.origin.y + (Math.cos(direction) * rayLength) / 2,
            };
        }
    }

    return {
        x: marking.origin.x,
        y: marking.origin.y,
    };
};

export const createSingleFeatureCropPair = async (
    feature: MatchedFeature,
    leftMeta: ImageMeta,
    rightMeta: ImageMeta,
    markingTypes: MarkingType[],
    sizeScale = 1.6
): Promise<DetailCropPair> => {
    const [leftSingleCanvas, rightSingleCanvas] = await Promise.all([
        renderImageWithMarkings(
            leftMeta.bytes,
            [feature.left],
            markingTypes,
            sizeScale,
            undefined,
            { showMarkingLabels: false, markingsAlpha: 0.45 }
        ),
        renderImageWithMarkings(
            rightMeta.bytes,
            [feature.right],
            markingTypes,
            sizeScale,
            undefined,
            { showMarkingLabels: false, markingsAlpha: 0.45 }
        ),
    ]);

    const rightRotationRad = getAlignmentRotationRad(
        feature.left,
        feature.right
    );
    const leftTypeDefinition = markingTypes.find(
        type => type.id === feature.left.typeId
    );
    const rightTypeDefinition = markingTypes.find(
        type => type.id === feature.right.typeId
    );
    const leftCenter = getFeatureCropCenter(
        feature.left,
        leftTypeDefinition,
        sizeScale
    );
    const rightCenter = getFeatureCropCenter(
        feature.right,
        rightTypeDefinition,
        sizeScale
    );

    const leftTargetSize = Math.max(
        1,
        Math.min(
            IMAGE_CELL_SIZE,
            leftSingleCanvas.width,
            leftSingleCanvas.height
        )
    );
    const leftCropped = cropCanvas(
        leftSingleCanvas,
        leftCenter.x,
        leftCenter.y,
        leftTargetSize
    );

    const rightTargetSize = Math.max(
        1,
        Math.min(
            IMAGE_CELL_SIZE,
            rightSingleCanvas.width,
            rightSingleCanvas.height
        )
    );
    let rightCropped: HTMLCanvasElement;

    if (Math.abs(rightRotationRad) < 1e-4) {
        rightCropped = cropCanvas(
            rightSingleCanvas,
            rightCenter.x,
            rightCenter.y,
            rightTargetSize
        );
    } else {
        const expandedSize = getExpandedCropSizeForRotation(
            rightTargetSize,
            rightRotationRad
        );
        const safeSize = Math.max(
            1,
            Math.min(
                expandedSize,
                rightSingleCanvas.width,
                rightSingleCanvas.height
            )
        );
        const expandedCropped = cropCanvas(
            rightSingleCanvas,
            rightCenter.x,
            rightCenter.y,
            safeSize
        );
        rightCropped = rotateCanvas(
            expandedCropped,
            rightRotationRad,
            rightTargetSize
        );
    }

    return {
        left: leftCropped.toDataURL("image/png"),
        right: rightCropped.toDataURL("image/png"),
    };
};

export const createDetailCropPairs = async (
    features: MatchedFeature[],
    leftMeta: ImageMeta,
    rightMeta: ImageMeta,
    markingTypes: MarkingType[],
    sizeScale = 1.6
): Promise<DetailCropPair[]> =>
    Promise.all(
        features.map(feature =>
            createSingleFeatureCropPair(
                feature,
                leftMeta,
                rightMeta,
                markingTypes,
                sizeScale
            )
        )
    );
