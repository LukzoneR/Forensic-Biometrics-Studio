import * as PIXI from "pixi.js";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import type { ImageMeta } from "../core/types";
import {
    cropCanvas,
    getMarkingCenter,
    getMarkingExtent,
} from "../rendering/canvas-utils";
import { getImageMeta, getSpritePath } from "../rendering/image-meta";
import { renderImageWithMarkings } from "../rendering/pixi-renderer";

export {
    cropCanvas,
    getMarkingCenter,
    getMarkingExtent,
    getSpritePath,
    renderImageWithMarkings,
};

export const getImageMetaShoeprint = async (
    sprite: PIXI.Sprite
): Promise<ImageMeta> => getImageMeta(sprite, "sha256");

// Re-export getImageMeta with SHA-256 by default for shoeprints
export const getImageMetaWrapper = async (
    sprite: PIXI.Sprite
): Promise<ImageMeta> => getImageMeta(sprite, "sha256");

export { getImageMetaWrapper as getImageMeta };

export const renderImageWithMarkingsShoeprint = (
    imageBytes: Uint8Array,
    markings: MarkingClass[],
    markingTypes: MarkingType[],
    sizeScale: number,
    options?: { showMarkingLabels?: boolean; markingsAlpha?: number }
) =>
    renderImageWithMarkings(
        imageBytes,
        markings,
        markingTypes,
        sizeScale,
        undefined,
        options
    );
