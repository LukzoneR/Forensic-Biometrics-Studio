import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MarkingsStore } from "@/lib/stores/Markings";
import { TracingStore } from "@/lib/stores/Tracing/Tracing.store";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import { FEATURES_PER_CHUNK } from "../core/constants";
import {
    createFigurePage,
    createReportRoot,
    createStyles,
} from "../core/dom-utils";
import { withReportI18n } from "../core/i18n-context";
import { renderPagesToPdf } from "../core/pdf-renderer";
import { buildReportIdentity } from "../core/report-identity";
import { getCanvasSprites } from "../core/viewport-context";
import { createOverviewCalloutImage } from "../rendering/callout-placement";
import { getImageMeta } from "../rendering/image-meta";
import { renderImageWithMarkings } from "../rendering/pixi-renderer";
import {
    getMatchedFeatures,
    getPairedByLabel,
    toDataUrl,
} from "../report-utils";
import { createDetailCropPairs } from "./crop-helpers";
import {
    appendFingerprintDetailPages,
    createFingerprintCoverPage,
    createFingerprintOverviewPage,
} from "./page-builders";
import type { FingerprintReportOptions } from "./types";

export const generateFingerprintReportPdf = async (
    options: FingerprintReportOptions
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

        await withReportI18n(
            options.reportLanguage,
            async ({ tReport, tKeywords }) => {
                stage = "get-sprites";
                const { leftSprite, rightSprite } = getCanvasSprites();

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
                const leftMeta = await getImageMeta(leftSprite, "md5");
                const rightMeta = await getImageMeta(rightSprite, "md5");
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

                stage = "detail-crops";
                const detailCrops = await createDetailCropPairs(
                    selectedFeatures,
                    leftMeta,
                    rightMeta,
                    markingTypes,
                    1.6
                );

                stage = "report-metadata";
                const identity = await buildReportIdentity(
                    options,
                    leftMeta,
                    rightMeta
                );

                stage = "chunk-features";
                const chunks = [];
                for (
                    let i = 0;
                    i < selectedFeatures.length;
                    i += FEATURES_PER_CHUNK
                ) {
                    chunks.push({
                        features: selectedFeatures.slice(
                            i,
                            i + FEATURES_PER_CHUNK
                        ),
                        crops: detailCrops.slice(i, i + FEATURES_PER_CHUNK),
                    });
                }

                stage = "overview-callouts";
                const overviewImages = await Promise.all(
                    chunks.map(async chunk => {
                        const [leftOverview, rightOverview] = await Promise.all(
                            [
                                createOverviewCalloutImage(
                                    leftMeta.bytes,
                                    chunk.features.map(x => x.left),
                                    { cropToBounds: true, color: "#cc0000" }
                                ),
                                createOverviewCalloutImage(
                                    rightMeta.bytes,
                                    chunk.features.map(x => x.right),
                                    { cropToBounds: true, color: "#cc0000" }
                                ),
                            ]
                        );
                        return { leftOverview, rightOverview };
                    })
                );

                stage = "build-dom";
                const root = createReportRoot();
                root.appendChild(createStyles());

                const coverPage = createFingerprintCoverPage({
                    identity,
                    leftMeta,
                    rightMeta,
                    matchedCount: matched.length,
                    selectedCount: selectedFeatures.length,
                    tReport,
                });

                const pages: HTMLElement[] = [coverPage];

                pages.push(
                    createFigurePage(
                        tReport("Figure 1"),
                        leftOriginal,
                        tReport("Image 1 label"),
                        pages.length + 1,
                        identity.reportId,
                        tReport
                    ),
                    createFigurePage(
                        tReport("Figure 2"),
                        leftAllCanvas.toDataURL("image/png"),
                        tReport("Image 1 label"),
                        pages.length + 1,
                        identity.reportId,
                        tReport
                    ),
                    createFigurePage(
                        tReport("Figure 3"),
                        rightOriginal,
                        tReport("Image 2 label"),
                        pages.length + 1,
                        identity.reportId,
                        tReport
                    ),
                    createFigurePage(
                        tReport("Figure 4"),
                        rightAllCanvas.toDataURL("image/png"),
                        tReport("Image 2 label"),
                        pages.length + 1,
                        identity.reportId,
                        tReport
                    )
                );

                chunks.forEach((chunk, chunkIdx) => {
                    const images = overviewImages.at(chunkIdx);
                    if (!images) return;

                    pages.push(
                        createFingerprintOverviewPage(
                            images.leftOverview,
                            images.rightOverview,
                            pages.length + 1,
                            identity.reportId,
                            chunkIdx,
                            chunks.length,
                            tReport
                        )
                    );

                    appendFingerprintDetailPages(
                        chunk,
                        chunkIdx,
                        chunks.length,
                        markingTypes,
                        pages,
                        identity.reportId,
                        tReport
                    );
                });

                stage = "render-pdf";
                await renderPagesToPdf(
                    root,
                    pages,
                    tKeywords("Generate report"),
                    `report-${identity.reportId}.pdf`
                );
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(`[report] failed at ${stage}: ${message}`, error);
        throw new Error(`Report failed at ${stage}: ${message}`);
    }
};
