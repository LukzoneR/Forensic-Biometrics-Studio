import { clamp } from "./report-utils";
import { CANVAS_CONTEXT_ERROR, FULL_CIRCLE } from "./report-types";

export const normalizeAngleRad = (value: number): number => {
    let angle = value;
    while (angle <= -Math.PI) angle += FULL_CIRCLE;
    while (angle > Math.PI) angle -= FULL_CIRCLE;
    return angle;
};

export const getExpandedCropSizeForRotation = (
    targetSize: number,
    rotateRad: number
): number => {
    const absSin = Math.abs(Math.sin(rotateRad));
    const absCos = Math.abs(Math.cos(rotateRad));
    return Math.ceil(targetSize * (absSin + absCos));
};

export const cropCanvas = (
    source: HTMLCanvasElement,
    centerX: number,
    centerY: number,
    size: number
): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(CANVAS_CONTEXT_ERROR);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const half = size / 2;
    const sx = Math.round(centerX - half);
    const sy = Math.round(centerY - half);

    const srcX = clamp(sx, 0, source.width);
    const srcY = clamp(sy, 0, source.height);
    const dstX = Math.max(0, -sx);
    const dstY = Math.max(0, -sy);
    const srcWidth = Math.max(0, Math.min(source.width - srcX, size - dstX));
    const srcHeight = Math.max(0, Math.min(source.height - srcY, size - dstY));

    if (srcWidth > 0 && srcHeight > 0) {
        ctx.drawImage(
            source,
            srcX,
            srcY,
            srcWidth,
            srcHeight,
            dstX,
            dstY,
            srcWidth,
            srcHeight
        );
    }

    return canvas;
};

export const rotateCanvas = (
    source: HTMLCanvasElement,
    rotateRad: number,
    targetSize: number
): HTMLCanvasElement => {
    const safeSize = source.width;
    const rotated = document.createElement("canvas");
    rotated.width = safeSize;
    rotated.height = safeSize;
    const rotatedCtx = rotated.getContext("2d");
    if (!rotatedCtx) throw new Error(CANVAS_CONTEXT_ERROR);
    rotatedCtx.translate(safeSize / 2, safeSize / 2);
    rotatedCtx.rotate(rotateRad);
    rotatedCtx.drawImage(source, -safeSize / 2, -safeSize / 2);
    rotatedCtx.setTransform(1, 0, 0, 1, 0, 0);

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = targetSize;
    finalCanvas.height = targetSize;
    const finalCtx = finalCanvas.getContext("2d");
    if (!finalCtx) throw new Error(CANVAS_CONTEXT_ERROR);
    const cutOffset = Math.max(0, (safeSize - targetSize) / 2);
    finalCtx.drawImage(
        rotated,
        cutOffset,
        cutOffset,
        targetSize,
        targetSize,
        0,
        0,
        targetSize,
        targetSize
    );

    return finalCanvas;
};
