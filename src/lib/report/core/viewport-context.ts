import * as PIXI from "pixi.js";
import { getCanvas } from "@/components/pixi/canvas/hooks/useCanvas";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";

export type CanvasSpritePair = {
    leftSprite: PIXI.Sprite;
    rightSprite: PIXI.Sprite;
};

export const getCanvasSprites = (): CanvasSpritePair => {
    const leftCanvas = getCanvas(CANVAS_ID.LEFT, true);
    const rightCanvas = getCanvas(CANVAS_ID.RIGHT, true);
    const leftViewport = leftCanvas.viewport;
    const rightViewport = rightCanvas.viewport;

    if (!leftViewport || !rightViewport) {
        throw new Error("Viewports are not ready.");
    }

    const leftSprite = leftViewport.children.find(
        x => x instanceof PIXI.Sprite
    ) as PIXI.Sprite | undefined;
    const rightSprite = rightViewport.children.find(
        x => x instanceof PIXI.Sprite
    ) as PIXI.Sprite | undefined;

    if (!leftSprite || !rightSprite) {
        throw new Error("Load both images before generating the report.");
    }

    return { leftSprite, rightSprite };
};
