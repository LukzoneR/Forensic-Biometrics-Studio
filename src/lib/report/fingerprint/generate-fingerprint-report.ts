import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { TracingStore } from "@/lib/stores/Tracing/Tracing.store";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import { createOverviewCalloutImage } from "../core/callout-placement";
import {
    createFigurePage,
    createReportRoot,
    createStyles,
} from "../core/dom-builder";
import { buildReportIdentity } from "../core/identity";
import { renderImageWithMarkings } from "../core/image-rendering";
import { renderPagesToPdf } from "../core/pdf-renderer";
import { runWithReportContext } from "../core/report-context";
import { FEATURES_PER_CHUNK, ROWS_PER_PAGE } from "../core/types";
import { getImageMeta, getReportSprites } from "../core/viewport-loader";
import {
    getMatchedFeatures,
    getPairedByLabel,
    toDataUrl,
} from "../report-utils";
import { generateFeatureDetailCrops } from "./crop-generator";
import {
    createFingerprintCoverPage,
    createFingerprintDetailPage,
    createFingerprintDetailRow,
    createFingerprintOverviewPage,
} from "./page-builders";
import type { FeatureChunk, ReportGenerationOptions } from "./types";

export const generateFingerprintReportPdfWithDialog = async (
    options: ReportGenerationOptions
): Promise<void> => {
    await runWithReportContext(
        { reportLanguage: options.reportLanguage, logPrefix: "report" },
        async ({ tReport, tKeywords, setStage }) => {
            setStage("check-working-mode");
            const { workingMode } = WorkingModeStore.state;
            if (
                workingMode !== WORKING_MODE.FINGERPRINT &&
                workingMode !== WORKING_MODE.SIGNATURE
            ) {
                throw new Error(
                    "Report generation is available only for fingerprints and signatures."
                );
            }

            setStage("get-sprites");
            const { leftSprite, rightSprite } = getReportSprites();

            setStage("collect-markings-and-tracings");
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
            const rightTracingPaths = TracingStore(CANVAS_ID.RIGHT).getState()
                .paths;

            const matched = options.includeMatchedOnly
                ? getMatchedFeatures(markingsLeft, markingsRight)
                : getPairedByLabel(markingsLeft, markingsRight);
            const selectedFeatures = matched;

            setStage("read-image-meta");
            const leftMeta = await getImageMeta(leftSprite);
            const rightMeta = await getImageMeta(rightSprite);

            setStage("image-data-urls");
            const leftOriginal = await toDataUrl(leftMeta.bytes, leftMeta.name);
            const rightOriginal = await toDataUrl(
                rightMeta.bytes,
                rightMeta.name
            );

            setStage("render-overlays");
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

            const detailCrops = await generateFeatureDetailCrops(
                selectedFeatures,
                leftMeta,
                rightMeta,
                markingTypes
            );

            setStage("report-metadata");
            const identity = await buildReportIdentity(
                options,
                leftMeta,
                rightMeta
            );
            const { reportId } = identity;

            setStage("build-dom");
            const root = createReportRoot();
            root.appendChild(createStyles());

            const pages: HTMLElement[] = [];

            const page1 = createFingerprintCoverPage(
                {
                    identity,
                    leftMeta,
                    rightMeta,
                    matchedCount: matched.length,
                    selectedCount: selectedFeatures.length,
                },
                tReport
            );
            pages.push(page1);

            pages.push(
                createFigurePage(
                    tReport("Figure 1"),
                    leftOriginal,
                    tReport("Image 1 label"),
                    pages.length + 1,
                    reportId,
                    tReport
                )
            );
            pages.push(
                createFigurePage(
                    tReport("Figure 2"),
                    leftAllCanvas.toDataURL("image/png"),
                    tReport("Image 1 label"),
                    pages.length + 1,
                    reportId,
                    tReport
                )
            );
            pages.push(
                createFigurePage(
                    tReport("Figure 3"),
                    rightOriginal,
                    tReport("Image 2 label"),
                    pages.length + 1,
                    reportId,
                    tReport
                )
            );
            pages.push(
                createFigurePage(
                    tReport("Figure 4"),
                    rightAllCanvas.toDataURL("image/png"),
                    tReport("Image 2 label"),
                    pages.length + 1,
                    reportId,
                    tReport
                )
            );

            const chunks: FeatureChunk[] = [];
            for (
                let i = 0;
                i < selectedFeatures.length;
                i += FEATURES_PER_CHUNK
            ) {
                chunks.push({
                    features: selectedFeatures.slice(i, i + FEATURES_PER_CHUNK),
                    crops: detailCrops.slice(i, i + FEATURES_PER_CHUNK),
                });
            }

            const overviewImages = await Promise.all(
                chunks.map(async chunk => {
                    const [leftOverview, rightOverview] = await Promise.all([
                        createOverviewCalloutImage(
                            leftMeta.bytes,
                            chunk.features.map(x => x.left)
                        ),
                        createOverviewCalloutImage(
                            rightMeta.bytes,
                            chunk.features.map(x => x.right)
                        ),
                    ]);
                    return { leftOverview, rightOverview };
                })
            );

            chunks.forEach((chunk, chunkIdx) => {
                const overview = overviewImages.at(chunkIdx);
                if (!overview) return;

                const { leftOverview, rightOverview } = overview;
                const overviewPage = createFingerprintOverviewPage(
                    leftOverview,
                    rightOverview,
                    chunkIdx,
                    chunks.length,
                    pages.length + 1,
                    reportId,
                    tReport
                );
                pages.push(overviewPage);

                chunk.features.forEach((feature, idx) => {
                    const isNewPage = idx % ROWS_PER_PAGE === 0;

                    if (isNewPage) {
                        const detailPage = createFingerprintDetailPage(
                            chunkIdx,
                            chunks.length,
                            pages.length + 1,
                            reportId,
                            tReport
                        );
                        pages.push(detailPage);
                    }

                    const currentPage = pages.at(-1);
                    if (!currentPage) return;
                    const tableBody = currentPage.querySelector(
                        "tbody"
                    ) as HTMLTableSectionElement | null;
                    if (!tableBody) return;

                    const crop = chunk.crops.at(idx);
                    if (!crop) return;

                    const row = createFingerprintDetailRow(
                        feature,
                        crop,
                        markingTypes,
                        tReport
                    );
                    tableBody.appendChild(row);
                });
            });

            setStage("render-pdf");
            await renderPagesToPdf(
                root,
                pages,
                tKeywords("Generate report"),
                `report-${reportId}.pdf`
            );
        }
    );
};
