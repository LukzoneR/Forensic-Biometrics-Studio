import * as PIXI from "pixi.js";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { getCanvas } from "@/components/pixi/canvas/hooks/useCanvas";
import { md5Bytes, sha256Bytes, toBlobBytes } from "../report-utils";
import type { ImageMeta } from "./types";

export const getSystemId = async (): Promise<string> => {
    try {
        const id = await invoke<string>("get_machine_id");
        return id || "unknown";
    } catch {
        return "unknown";
    }
};

export const getSpritePath = (sprite: PIXI.Sprite): string | null => {
    // @ts-expect-error custom property
    const path = sprite.path as string | null;
    return path || null;
};

export const getReportSprites = (): {
    leftSprite: PIXI.Sprite;
    rightSprite: PIXI.Sprite;
} => {
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

export const getImageMeta = async (
    sprite: PIXI.Sprite,
    options?: { hashAlgorithm?: "md5" | "sha256" }
): Promise<ImageMeta> => {
    const fullPath = getSpritePath(sprite);
    if (!fullPath) {
        throw new Error("Missing image path for report generation.");
    }

    const bytes = await readFile(fullPath);
    const bitmap = await createImageBitmap(new Blob([toBlobBytes(bytes)]));

    const algorithm = options?.hashAlgorithm ?? "md5";
    const checksum =
        algorithm === "sha256" ? await sha256Bytes(bytes) : md5Bytes(bytes);

    return {
        name: sprite.name ?? "image",
        width: bitmap.width,
        height: bitmap.height,
        sizeBytes: bytes.byteLength,
        checksum,
        bytes,
    };
};
