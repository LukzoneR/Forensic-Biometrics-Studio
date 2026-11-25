import { MarkingClass } from "@/lib/markings/MarkingClass";
import { CANVAS_CONTEXT_ERROR, FULL_CIRCLE } from "../core/constants";
import { clamp } from "../report-utils";

export const normalizeAngleRad = (value: number): number => {
    let angle = value;
    while (angle <= -Math.PI) angle += FULL_CIRCLE;
    while (angle > Math.PI) angle -= FULL_CIRCLE;
    return angle;
};

export const getMarkingDirectionRad = (
    marking: MarkingClass
): number | null => {
    const withAngle = marking as MarkingClass & { angleRad?: unknown };
    if (
        typeof withAngle.angleRad === "number" &&
        Number.isFinite(withAngle.angleRad)
    ) {
        return withAngle.angleRad;
    }

    const withEndpoint = marking as MarkingClass & {
        endpoint?: { x: number; y: number };
    };
    if (
        withEndpoint.endpoint &&
        Number.isFinite(withEndpoint.endpoint.x) &&
        Number.isFinite(withEndpoint.endpoint.y)
    ) {
        const dx = withEndpoint.endpoint.x - marking.origin.x;
        const dy = withEndpoint.endpoint.y - marking.origin.y;
        if (dx === 0 && dy === 0) return null;
        return Math.atan2(dy, dx);
    }

    return null;
};

export const getAlignmentRotationRad = (
    left: MarkingClass,
    right: MarkingClass
): number => {
    const leftDirection = getMarkingDirectionRad(left);
    const rightDirection = getMarkingDirectionRad(right);
    if (leftDirection === null || rightDirection === null) {
        return 0;
    }

    return normalizeAngleRad(leftDirection - rightDirection);
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

export const getMarkingCenter = (
    marking: MarkingClass
): { x: number; y: number } => {
    const withEndpoint = marking as MarkingClass & {
        endpoint?: { x: number; y: number };
    };
    if (withEndpoint.endpoint) {
        return {
            x: (marking.origin.x + withEndpoint.endpoint.x) / 2,
            y: (marking.origin.y + withEndpoint.endpoint.y) / 2,
        };
    }
    return { x: marking.origin.x, y: marking.origin.y };
};

export const getMarkingExtent = (marking: MarkingClass): number => {
    const withEndpoint = marking as MarkingClass & {
        endpoint?: { x: number; y: number };
    };
    if (withEndpoint.endpoint) {
        const w = Math.abs(withEndpoint.endpoint.x - marking.origin.x);
        const h = Math.abs(withEndpoint.endpoint.y - marking.origin.y);
        return Math.max(w, h);
    }
    return 20;
};
