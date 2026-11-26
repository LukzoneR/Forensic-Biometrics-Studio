import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import * as PIXI from "pixi.js";
import i18n from "@/lib/locales/i18n";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { ensureImagesLoaded } from "./dom-utils";
import {
    ImageMeta,
    KeywordsT,
    ReportIdentity,
    ReportMetadataOptions,
    ReportT,
} from "./report-types";
import {
    formatReportDateTime,
    md5Bytes,
    md5String,
    sha256Bytes,
    toBlobBytes,
} from "./report-utils";

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
    return path ?? null;
};

export const getImageMeta = async (
    sprite: PIXI.Sprite,
    options?: { checksumAlgorithm?: "md5" | "sha256" }
): Promise<ImageMeta> => {
    const fullPath = getSpritePath(sprite);
    if (!fullPath) {
        throw new Error("Missing image path for report generation.");
    }
    const bytes = await readFile(fullPath);
    const bitmap = await createImageBitmap(new Blob([toBlobBytes(bytes)]));
    const checksum =
        options?.checksumAlgorithm === "sha256"
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

export const runWithReportLanguage = async <T>(
    requestedLanguage: string | undefined,
    task: (tReport: ReportT, tKeywords: KeywordsT) => Promise<T>
): Promise<T> => {
    const previousLanguage = i18n.language;
    let languageChanged = false;

    try {
        const reportLanguage =
            requestedLanguage ||
            GlobalSettingsStore.state.settings.language ||
            i18n.language ||
            "pl";

        if (reportLanguage !== previousLanguage) {
            await i18n.changeLanguage(reportLanguage);
            languageChanged = true;
        }

        await i18n.loadNamespaces(["report", "keywords"]);
        const tReport = i18n.getFixedT(reportLanguage, "report");
        const tKeywords = i18n.getFixedT(reportLanguage, "keywords");

        return await task(tReport, tKeywords);
    } finally {
        if (languageChanged) {
            await i18n.changeLanguage(previousLanguage);
        }
    }
};

export const buildReportIdentity = async (
    options: ReportMetadataOptions,
    leftMeta: ImageMeta,
    rightMeta: ImageMeta
): Promise<ReportIdentity> => {
    const reportSettings = GlobalSettingsStore.state.settings.report;
    const reportDateTime =
        options.reportDateTime?.trim() || formatReportDateTime(new Date());
    const systemId = await getSystemId();
    const reportId = md5String(
        [
            reportDateTime,
            leftMeta.sizeBytes,
            leftMeta.checksum,
            rightMeta.sizeBytes,
            rightMeta.checksum,
            systemId,
        ].join("|")
    );

    const decodeUnicodeEscapes = (value: string) =>
        value.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        );

    const performedBy = decodeUnicodeEscapes(
        options.performedBy?.trim() || reportSettings?.performedBy || "-"
    );
    const department = decodeUnicodeEscapes(
        options.department?.trim() || reportSettings?.department || "-"
    );
    const addressFallback = [
        reportSettings?.addressLine1,
        reportSettings?.addressLine2,
        reportSettings?.addressLine3,
        reportSettings?.addressLine4,
    ]
        .map(line => line?.trim())
        .filter(Boolean) as string[];
    const addressLines =
        options.addressLines?.map(line => line.trim()).filter(Boolean) ?? [];
    const address = (
        addressLines.length > 0 ? addressLines : addressFallback
    ).map(line => decodeUnicodeEscapes(line));

    const appVersion = await getVersion();

    return {
        reportId,
        reportDateTime,
        performedBy,
        department,
        address,
        appVersion,
    };
};

export const renderPagesToPdf = async (
    root: HTMLElement,
    pages: HTMLElement[],
    saveTitle: string,
    defaultFileName: string
): Promise<void> => {
    pages.forEach(page => root.appendChild(page));
    document.body.appendChild(root);

    try {
        await ensureImagesLoaded(root);
        const pdf = await PDFDocument.create();
        const renderedPages = await Promise.all(
            pages.map(page =>
                html2canvas(page, { scale: 2, backgroundColor: "#ffffff" })
            )
        );

        await renderedPages.reduce(
            async (chainPromise, canvas) => {
                const chain = await chainPromise;
                const pngBytes = canvas.toDataURL("image/png");
                const image = await pdf.embedPng(pngBytes);
                const page = pdf.addPage([canvas.width, canvas.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: canvas.width,
                    height: canvas.height,
                });
                chain.push(page);
                return chain;
            },
            Promise.resolve([] as ReturnType<typeof pdf.addPage>[])
        );

        const pdfBytes = await pdf.save();

        const filePath = await save({
            title: saveTitle,
            filters: [{ name: "PDF", extensions: ["pdf"] }],
            canCreateDirectories: true,
            defaultPath: defaultFileName,
        });

        if (!filePath) return;

        await writeFile(filePath, pdfBytes);
    } finally {
        root.remove();
    }
};
