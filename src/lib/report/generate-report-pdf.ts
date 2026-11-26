import * as PIXI from "pixi.js";
import { getCanvas } from "@/components/pixi/canvas/hooks/useCanvas";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { MarkingType } from "@/lib/markings/MarkingType";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MarkingsStore } from "@/lib/stores/Markings";
import { TracingStore } from "@/lib/stores/Tracing/Tracing.store";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import {
    cropCanvas,
    getExpandedCropSizeForRotation,
    rotateCanvas,
} from "./canvas-utils";
import { createOverviewCalloutImage } from "./callout-placement";
import {
    createFigurePage,
    createFooter,
    createLandscapePage,
    createPage,
    createReportRoot,
    createStyles,
    escapeHtml,
    resolveFeatureTypeName,
    toCssColor,
} from "./dom-utils";
import {
    buildReportIdentity,
    getImageMeta,
    renderPagesToPdf,
    runWithReportLanguage,
} from "./pdf-render-service";
import {
    getAlignmentRotationRad,
    getFeatureCropCenter,
    renderImageWithMarkings,
} from "./pixi-render-utils";
import {
    ImageMeta,
    IMAGE_CELL_SIZE,
    RenderedImages,
    ReportGenerationOptions,
    ReportIdentity,
    ReportMetadataOptions,
    ReportT,
} from "./report-types";
import {
    formatBytes,
    getMatchedFeatures,
    getPairedByLabel,
    toDataUrl,
} from "./report-utils";

export {
    buildReportIdentity,
    createFigurePage,
    createFooter,
    createPage,
    createReportRoot,
    createStyles,
    escapeHtml,
    getImageMeta,
    type ImageMeta,
    renderImageWithMarkings,
    renderPagesToPdf,
    type ReportIdentity,
    type ReportMetadataOptions,
    type ReportT,
    toDataUrl,
};

const ROWS_PER_PAGE = 4;
const FEATURES_PER_CHUNK = 12;

type FeaturePair = {
    id: string;
    left: MarkingClass;
    right: MarkingClass;
};

type FeatureDetailCrop = {
    left: string;
    right: string;
};

type ChunkData = {
    features: FeaturePair[];
    crops: FeatureDetailCrop[];
    leftOverview: string;
    rightOverview: string;
};

const getReportSprites = () => {
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

const renderFeatureCrops = async (
    feature: FeaturePair,
    leftMeta: ImageMeta,
    rightMeta: ImageMeta,
    markingTypes: MarkingType[]
): Promise<FeatureDetailCrop> => {
    const [leftSingleCanvas, rightSingleCanvas] = await Promise.all([
        renderImageWithMarkings(
            leftMeta.bytes,
            [feature.left],
            markingTypes,
            1.6,
            undefined,
            { showMarkingLabels: false, markingsAlpha: 0.45 }
        ),
        renderImageWithMarkings(
            rightMeta.bytes,
            [feature.right],
            markingTypes,
            1.6,
            undefined,
            { showMarkingLabels: false, markingsAlpha: 0.45 }
        ),
    ]);

    const rightRotationRad = getAlignmentRotationRad(
        feature.left,
        feature.right
    );
    const leftTypeDefinition = markingTypes.find(
        type => type.id === feature.left.typeId
    );
    const rightTypeDefinition = markingTypes.find(
        type => type.id === feature.right.typeId
    );
    const leftCenter = getFeatureCropCenter(
        feature.left,
        leftTypeDefinition,
        1.6
    );
    const rightCenter = getFeatureCropCenter(
        feature.right,
        rightTypeDefinition,
        1.6
    );

    const leftTargetSize = Math.max(
        1,
        Math.min(
            IMAGE_CELL_SIZE,
            leftSingleCanvas.width,
            leftSingleCanvas.height
        )
    );
    const leftCropped = cropCanvas(
        leftSingleCanvas,
        leftCenter.x,
        leftCenter.y,
        leftTargetSize
    );

    const rightTargetSize = Math.max(
        1,
        Math.min(
            IMAGE_CELL_SIZE,
            rightSingleCanvas.width,
            rightSingleCanvas.height
        )
    );
    let rightCropped: HTMLCanvasElement;

    if (Math.abs(rightRotationRad) < 1e-4) {
        rightCropped = cropCanvas(
            rightSingleCanvas,
            rightCenter.x,
            rightCenter.y,
            rightTargetSize
        );
    } else {
        const expandedSize = getExpandedCropSizeForRotation(
            rightTargetSize,
            rightRotationRad
        );
        const safeSize = Math.max(
            1,
            Math.min(
                expandedSize,
                rightSingleCanvas.width,
                rightSingleCanvas.height
            )
        );
        const expandedCropped = cropCanvas(
            rightSingleCanvas,
            rightCenter.x,
            rightCenter.y,
            safeSize
        );
        rightCropped = rotateCanvas(
            expandedCropped,
            rightRotationRad,
            rightTargetSize
        );
    }

    return {
        left: leftCropped.toDataURL("image/png"),
        right: rightCropped.toDataURL("image/png"),
    };
};

const buildFirstPage = (
    reportId: string,
    reportDateTime: string,
    performedBy: string,
    department: string,
    address: string[],
    appVersion: string,
    leftMeta: ImageMeta,
    rightMeta: ImageMeta,
    matchedCount: number,
    selectedCount: number,
    tReport: ReportT
): HTMLElement => {
    const addressHtml =
        address.length > 0
            ? address.map(line => `<div>${escapeHtml(line)}</div>`).join("")
            : "<div>-</div>";

    const page1 = createPage();
    page1.innerHTML = `
        <div class="report-title">${tReport("Technical report title")}</div>

        <div class="kv-row">
            <div class="kv-label">${tReport("Report ID label")}</div>
            <div class="kv-value">${escapeHtml(reportId)}</div>
        </div>
        <div class="kv-row">
            <div class="kv-label">${tReport("Report date and time label")}</div>
            <div class="kv-value">${escapeHtml(reportDateTime)}</div>
        </div>

        <div class="performer-title">${tReport("Performed by label")}</div>
        <div class="performer-data">
            ${performedBy ? `<div>${escapeHtml(performedBy)}</div>` : ""}
            ${department ? `<div>${escapeHtml(department)}</div>` : ""}
            ${addressHtml}
        </div>

        <div class="software-title">${tReport("Software information")}:</div>
        <div class="kv-row">
            <div class="kv-label">${tReport("Application name")}</div>
            <div class="kv-value">Biometrics-Studio</div>
        </div>
        <div class="kv-row">
            <div class="kv-label">${tReport("Application version")}</div>
            <div class="kv-value">${escapeHtml(appVersion)}</div>
        </div>

        <div class="section-title-large">${tReport("Input material")}:</div>
        
        <div class="performer-title" style="margin-top: 10px;">${tReport("Image 1")}</div>
        <div class="kv-row"><div class="kv-label" style="font-weight: normal; width: 220px; padding-left: 20px;">- ${tReport("File name")}</div><div class="kv-value">${escapeHtml(leftMeta.name)}</div></div>
        <div class="kv-row"><div class="kv-label" style="font-weight: normal; width: 220px; padding-left: 20px;">- ${tReport("Image dimensions")}</div><div class="kv-value">${leftMeta.width} x ${leftMeta.height} px</div></div>
        <div class="kv-row"><div class="kv-label" style="font-weight: normal; width: 220px; padding-left: 20px;">- ${tReport("Size")}</div><div class="kv-value">${formatBytes(leftMeta.sizeBytes)}</div></div>
        <div class="kv-row"><div class="kv-label" style="font-weight: normal; width: 220px; padding-left: 20px;">- ${tReport("Checksum")}</div><div class="kv-value" style="font-family: monospace;">${leftMeta.checksum}</div></div>

        <div class="performer-title" style="margin-top: 15px;">${tReport("Image 2")}</div>
        <div class="kv-row"><div class="kv-label" style="font-weight: normal; width: 220px; padding-left: 20px;">- ${tReport("File name")}</div><div class="kv-value">${escapeHtml(rightMeta.name)}</div></div>
        <div class="kv-row"><div class="kv-label" style="font-weight: normal; width: 220px; padding-left: 20px;">- ${tReport("Image dimensions")}</div><div class="kv-value">${rightMeta.width} x ${rightMeta.height} px</div></div>
        <div class="kv-row"><div class="kv-label" style="font-weight: normal; width: 220px; padding-left: 20px;">- ${tReport("Size")}</div><div class="kv-value">${formatBytes(rightMeta.sizeBytes)}</div></div>
        <div class="kv-row"><div class="kv-label" style="font-weight: normal; width: 220px; padding-left: 20px;">- ${tReport("Checksum")}</div><div class="kv-value" style="font-family: monospace;">${rightMeta.checksum}</div></div>

        <div class="counts" style="margin-top: 30px;">
            <div class="kv-row">
                <div class="kv-label" style="width: 350px;">${tReport("Matched features count")}</div>
                <div class="kv-value"><strong>${matchedCount}</strong></div>
            </div>
            <div class="kv-row">
                <div class="kv-label" style="width: 350px;">${tReport("Selected features count")}</div>
                <div class="kv-value"><strong>${selectedCount}</strong></div>
            </div>
        </div>

        <div class="note">
            <div class="performer-title" style="font-size: 11px; margin-top: 0;">${tReport("Note title")}:</div>
            <div style="margin-top: 4px;">${tReport("Note body")}</div>
        </div>

        ${createFooter(1, reportId, tReport)}
    `;

    return page1;
};

const appendChunkPages = (
    pages: HTMLElement[],
    chunk: ChunkData,
    chunkIdx: number,
    totalChunks: number,
    reportId: string,
    markingTypes: MarkingType[],
    tReport: ReportT
) => {
    const overviewPage = createLandscapePage();
    const overviewTitle =
        totalChunks > 1
            ? `${tReport("Comparative table overview")} (${chunkIdx + 1}/${totalChunks})`
            : tReport("Comparative table overview");

    overviewPage.innerHTML = `
        <div class="section-title">${escapeHtml(overviewTitle)}</div>
        <div class="overview-grid landscape">
            <img src="${chunk.leftOverview}" alt="Left overview" />
            <img src="${chunk.rightOverview}" alt="Right overview" />
        </div>
        ${createFooter(pages.length + 1, reportId, tReport)}
    `;
    pages.push(overviewPage);

    chunk.features.forEach((feature, idx) => {
        const isNewPage = idx % ROWS_PER_PAGE === 0;

        if (isNewPage) {
            const detailPage = createPage();
            const detailTitle =
                totalChunks > 1
                    ? `${tReport("Comparative table details")} (${chunkIdx + 1}/${totalChunks})`
                    : tReport("Comparative table details");

            detailPage.innerHTML = `
                <div class="section-title">${escapeHtml(detailTitle)}</div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>${tReport("Feature")}</th>
                            <th>${tReport("Image 1")}</th>
                            <th>${tReport("Image 2")}</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
                ${createFooter(pages.length + 1, reportId, tReport)}
            `;
            pages.push(detailPage);
        }

        const currentPage = pages[pages.length - 1];
        if (!currentPage) return;
        const tableBody = currentPage.querySelector("tbody");
        if (!tableBody) return;

        const featureTypeDefinition = markingTypes.find(
            type => type.id === feature.left.typeId
        );
        const featureType = resolveFeatureTypeName(
            featureTypeDefinition,
            tReport
        );
        const escapedFeatureType = escapeHtml(featureType);
        const markerRing = toCssColor(
            featureTypeDefinition?.backgroundColor,
            "#cc0000"
        );
        const markerOutline = toCssColor(
            featureTypeDefinition?.textColor,
            "#7a0000"
        );

        const detailCrop = chunk.crops.at(idx);
        if (!detailCrop) return;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <div class="feature-cell">
                    <div
                        class="feature-index"
                        style="--marker-ring: ${markerRing}; --marker-outline: ${markerOutline}; --marker-text: ${markerOutline};"
                    >
                        <span class="feature-index-value">${feature.left.label}</span>
                    </div>
                    <div class="feature-type">${tReport("Feature type")} ${escapedFeatureType}</div>
                </div>
            </td>
            <td><img class="feature-image" src="${detailCrop.left}" alt="${escapedFeatureType} (left)" /></td>
            <td><img class="feature-image" src="${detailCrop.right}" alt="${escapedFeatureType} (right)" /></td>
        `;
        tableBody.appendChild(row);
    });
};

export const generateReportPdfWithDialog = async (
    options: ReportGenerationOptions
): Promise<void> => {
    let stage = "init";

    try {
        stage = "check-working-mode";
        const { workingMode } = WorkingModeStore.state;
        if (
            workingMode !== WORKING_MODE.FINGERPRINT &&
            workingMode !== WORKING_MODE.SIGNATURE
        ) {
            throw new Error(
                "Report generation is available only for fingerprints and signatures."
            );
        }

        await runWithReportLanguage(
            options.reportLanguage,
            async (tReport, tKeywords) => {
                stage = "get-sprites";
                const { leftSprite, rightSprite } = getReportSprites();

                stage = "collect-markings-and-tracings";
                const markingsLeft = MarkingsStore(
                    CANVAS_ID.LEFT
                ).state.markings.filter(m =>
                    options.selectedLabels.includes(m.label)
                );
                const markingsRight = MarkingsStore(
                    CANVAS_ID.RIGHT
                ).state.markings.filter(m =>
                    options.selectedLabels.includes(m.label)
                );

                const markingTypes = MarkingTypesStore.state.types;

                const leftTracingPaths = TracingStore(CANVAS_ID.LEFT).getState()
                    .paths;
                const rightTracingPaths = TracingStore(
                    CANVAS_ID.RIGHT
                ).getState().paths;

                const matched = options.includeMatchedOnly
                    ? getMatchedFeatures(markingsLeft, markingsRight)
                    : getPairedByLabel(markingsLeft, markingsRight);

                stage = "read-image-meta";
                const leftMeta = await getImageMeta(leftSprite);
                const rightMeta = await getImageMeta(rightSprite);
                const selectedFeatures = matched;

                stage = "image-data-urls";
                const leftOriginal = await toDataUrl(
                    leftMeta.bytes,
                    leftMeta.name
                );
                const rightOriginal = await toDataUrl(
                    rightMeta.bytes,
                    rightMeta.name
                );

                stage = "render-overlays";
                const [leftAllCanvas, rightAllCanvas] = await Promise.all([
                    renderImageWithMarkings(
                        leftMeta.bytes,
                        markingsLeft,
                        markingTypes,
                        1.6,
                        leftTracingPaths
                    ),
                    renderImageWithMarkings(
                        rightMeta.bytes,
                        markingsRight,
                        markingTypes,
                        1.6,
                        rightTracingPaths
                    ),
                ]);

                const detailCrops = await Promise.all(
                    selectedFeatures.map(feature =>
                        renderFeatureCrops(
                            feature,
                            leftMeta,
                            rightMeta,
                            markingTypes
                        )
                    )
                );

                const leftImages: RenderedImages = {
                    originalDataUrl: leftOriginal,
                    allMarkingsCanvas: leftAllCanvas,
                };
                const rightImages: RenderedImages = {
                    originalDataUrl: rightOriginal,
                    allMarkingsCanvas: rightAllCanvas,
                };

                stage = "report-metadata";
                const {
                    reportId,
                    reportDateTime,
                    performedBy,
                    department,
                    address,
                    appVersion,
                } = await buildReportIdentity(options, leftMeta, rightMeta);

                stage = "build-dom";
                const root = createReportRoot();
                root.appendChild(createStyles());

                const page1 = buildFirstPage(
                    reportId,
                    reportDateTime,
                    performedBy,
                    department,
                    address,
                    appVersion,
                    leftMeta,
                    rightMeta,
                    matched.length,
                    selectedFeatures.length,
                    tReport
                );

                const pages: HTMLElement[] = [page1];

                pages.push(
                    createFigurePage(
                        tReport("Figure 1"),
                        leftImages.originalDataUrl,
                        tReport("Image 1 label"),
                        pages.length + 1,
                        reportId,
                        tReport
                    )
                );
                pages.push(
                    createFigurePage(
                        tReport("Figure 2"),
                        leftImages.allMarkingsCanvas.toDataURL("image/png"),
                        tReport("Image 1 label"),
                        pages.length + 1,
                        reportId,
                        tReport
                    )
                );
                pages.push(
                    createFigurePage(
                        tReport("Figure 3"),
                        rightImages.originalDataUrl,
                        tReport("Image 2 label"),
                        pages.length + 1,
                        reportId,
                        tReport
                    )
                );
                pages.push(
                    createFigurePage(
                        tReport("Figure 4"),
                        rightImages.allMarkingsCanvas.toDataURL("image/png"),
                        tReport("Image 2 label"),
                        pages.length + 1,
                        reportId,
                        tReport
                    )
                );

                const rawChunks: {
                    features: typeof selectedFeatures;
                    crops: typeof detailCrops;
                }[] = [];
                for (
                    let i = 0;
                    i < selectedFeatures.length;
                    i += FEATURES_PER_CHUNK
                ) {
                    rawChunks.push({
                        features: selectedFeatures.slice(
                            i,
                            i + FEATURES_PER_CHUNK
                        ),
                        crops: detailCrops.slice(i, i + FEATURES_PER_CHUNK),
                    });
                }

                const chunks: ChunkData[] = await Promise.all(
                    rawChunks.map(async chunk => {
                        const [leftOverview, rightOverview] = await Promise.all(
                            [
                                createOverviewCalloutImage(
                                    leftMeta.bytes,
                                    chunk.features.map(x => x.left)
                                ),
                                createOverviewCalloutImage(
                                    rightMeta.bytes,
                                    chunk.features.map(x => x.right)
                                ),
                            ]
                        );
                        return {
                            features: chunk.features,
                            crops: chunk.crops,
                            leftOverview,
                            rightOverview,
                        };
                    })
                );

                chunks.forEach((chunk, chunkIdx) => {
                    appendChunkPages(
                        pages,
                        chunk,
                        chunkIdx,
                        chunks.length,
                        reportId,
                        markingTypes,
                        tReport
                    );
                });

                stage = "render-pdf";
                await renderPagesToPdf(
                    root,
                    pages,
                    tKeywords("Generate report"),
                    `report-${reportId}.pdf`
                );
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Report failed at ${stage}: ${message}`);
    }
};
