import type * as PIXI from "pixi.js";
import type { MarkingClass } from "@/lib/markings/MarkingClass";
import type { MarkingType } from "@/lib/markings/MarkingType";
import {
    cropCanvas,
    getMarkingCenter,
    getMarkingExtent,
    renderImageWithMarkings as coreRenderImageWithMarkings,
    type RenderImageOptions,
} from "../core/image-rendering";
import type { ImageMeta } from "../core/types";
import {
    getImageMeta as coreGetImageMeta,
    getSpritePath,
} from "../core/viewport-loader";

export { getSpritePath, cropCanvas, getMarkingCenter, getMarkingExtent };

export const getImageMeta = async (sprite: PIXI.Sprite): Promise<ImageMeta> =>
    coreGetImageMeta(sprite, { hashAlgorithm: "sha256" });

export const renderImageWithMarkings = async (
    imageBytes: Uint8Array,
    markings: MarkingClass[],
    markingTypes: MarkingType[],
    sizeScale: number,
    options?: RenderImageOptions
): Promise<HTMLCanvasElement> =>
    coreRenderImageWithMarkings(
        imageBytes,
        markings,
        markingTypes,
        sizeScale,
        undefined,
        options
    );
