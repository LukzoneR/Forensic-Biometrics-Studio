import * as PIXI from "pixi.js";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ImageMeta } from "../core/types";
import { md5Bytes, sha256Bytes, toBlobBytes } from "../report-utils";

export const getSpritePath = (sprite: PIXI.Sprite): string | null => {
    // @ts-expect-error custom property
    return (sprite.path as string | null) ?? null;
};

export const getImageMeta = async (
    sprite: PIXI.Sprite,
    checksumAlgorithm: "md5" | "sha256" = "md5"
): Promise<ImageMeta> => {
    const fullPath = getSpritePath(sprite);
    if (!fullPath) {
        throw new Error("Missing image path for report generation.");
    }
    const bytes = await readFile(fullPath);
    const bitmap = await createImageBitmap(new Blob([toBlobBytes(bytes)]));
    const checksum =
        checksumAlgorithm === "sha256"
            ? await sha256Bytes(bytes)
            : md5Bytes(bytes);

    return {
        name: sprite.name ?? "image",
        width: bitmap.width,
        height: bitmap.height,
        sizeBytes: bytes.byteLength,
        checksum,
        bytes,
    };
};
