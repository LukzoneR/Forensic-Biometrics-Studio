import type { MarkingType } from "@/lib/markings/MarkingType";
import {
    cropCanvas,
    getAlignmentRotationRad,
    getExpandedCropSizeForRotation,
    getFeatureCropCenter,
    renderImageWithMarkings,
    rotateCanvas,
} from "../core/image-rendering";
import {
    IMAGE_CELL_SIZE,
    type ImageMeta,
    type MatchedFeature,
} from "../core/types";
import type { FeatureCropPair } from "./types";

export const generateFeatureDetailCrop = async (
    feature: MatchedFeature,
    leftMeta: ImageMeta,
    rightMeta: ImageMeta,
    markingTypes: MarkingType[]
): Promise<FeatureCropPair> => {
    const [leftSingleCanvas, rightSingleCanvas] = await Promise.all([
        renderImageWithMarkings(
            leftMeta.bytes,
            [feature.left],
            markingTypes,
            1.6,
            undefined,
            { showMarkingLabels: false, markingsAlpha: 0.45 }
        ),
        renderImageWithMarkings(
            rightMeta.bytes,
            [feature.right],
            markingTypes,
            1.6,
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
        1.6
    );
    const rightCenter = getFeatureCropCenter(
        feature.right,
        rightTypeDefinition,
        1.6
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

export const generateFeatureDetailCrops = async (
    features: MatchedFeature[],
    leftMeta: ImageMeta,
    rightMeta: ImageMeta,
    markingTypes: MarkingType[]
): Promise<FeatureCropPair[]> =>
    Promise.all(
        features.map(feature =>
            generateFeatureDetailCrop(
                feature,
                leftMeta,
                rightMeta,
                markingTypes
            )
        )
    );
