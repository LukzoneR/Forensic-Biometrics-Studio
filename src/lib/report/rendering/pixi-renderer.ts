import * as PIXI from "pixi.js";
import { drawMarking } from "@/components/pixi/overlays/markings/marking.utils";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import { TracingPath } from "@/lib/stores/Tracing/Tracing.store";
import { toBlobBytes } from "../report-utils";

export interface RenderMarkingsOptions {
    showMarkingLabels?: boolean;
    markingsAlpha?: number;
}

export const renderImageWithMarkings = async (
    imageBytes: Uint8Array,
    markings: MarkingClass[],
    markingTypes: MarkingType[],
    sizeScale: number,
    tracingPathsOrOptions?: TracingPath[] | RenderMarkingsOptions,
    maybeOptions?: RenderMarkingsOptions
): Promise<HTMLCanvasElement> => {
    const tracingPaths = Array.isArray(tracingPathsOrOptions)
        ? tracingPathsOrOptions
        : undefined;
    const options = Array.isArray(tracingPathsOrOptions)
        ? maybeOptions
        : tracingPathsOrOptions;

    const bitmap = await createImageBitmap(new Blob([toBlobBytes(imageBytes)]));
    const { width, height } = bitmap;
    const showMarkingLabels = options?.showMarkingLabels ?? true;
    const markingsAlpha = options?.markingsAlpha ?? 1;

    const app = new PIXI.Application({
        width,
        height,
        backgroundAlpha: 0,
        antialias: true,
        preserveDrawingBuffer: true,
    });

    const sprite = new PIXI.Sprite(PIXI.Texture.from(bitmap));
    sprite.position.set(0, 0);
    app.stage.addChild(sprite);

    if (tracingPaths && tracingPaths.length > 0) {
        const tracingContainer = new PIXI.Container();

        tracingPaths.forEach(path => {
            const g = new PIXI.Graphics();
            g.lineStyle({
                width: path.brushSize,
                color: Number(path.color.replace("#", "0x")),
                alpha: path.opacity ?? 1,
                join: PIXI.LINE_JOIN.ROUND,
                cap: PIXI.LINE_CAP.ROUND,
            });

            if (path.points && path.points.length > 0) {
                const p0 = path.points[0];
                if (p0) {
                    g.moveTo(p0.x, p0.y);
                    path.points.slice(1).forEach(p => {
                        if (p) g.lineTo(p.x, p.y);
                    });
                }
            }

            tracingContainer.addChild(g);
        });

        app.stage.addChild(tracingContainer);
    }

    const g = new PIXI.Graphics();
    g.alpha = markingsAlpha;
    app.stage.addChild(g);

    const scaledTypes = markingTypes.map(type => ({
        ...type,
        size: Math.max(2, type.size * sizeScale),
    }));

    markings.forEach(marking => {
        const type = scaledTypes.find(t => t.id === marking.typeId);
        if (!type) return;
        drawMarking(
            g,
            false,
            marking,
            type,
            1,
            1,
            showMarkingLabels,
            undefined,
            0,
            width / 2,
            height / 2
        );
    });

    const canvas = app.renderer.extract.canvas(app.stage);
    app.destroy(true, { children: true, texture: true, baseTexture: true });
    return canvas as HTMLCanvasElement;
};
