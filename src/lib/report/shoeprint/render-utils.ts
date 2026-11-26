import * as PIXI from "pixi.js";
import { cropCanvas } from "../canvas-utils";
import {
    getImageMeta as getBaseImageMeta,
    getSpritePath,
} from "../pdf-render-service";
import {
    getMarkingCenter,
    getMarkingExtent,
    renderImageWithMarkings,
} from "../pixi-render-utils";
import { ImageMeta } from "./types";

export const getImageMeta = async (sprite: PIXI.Sprite): Promise<ImageMeta> =>
    getBaseImageMeta(sprite, { checksumAlgorithm: "sha256" });

export {
    cropCanvas,
    getMarkingCenter,
    getMarkingExtent,
    getSpritePath,
    renderImageWithMarkings,
};
