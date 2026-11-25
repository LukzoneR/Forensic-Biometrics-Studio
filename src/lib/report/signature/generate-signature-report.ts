import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MarkingsStore } from "@/lib/stores/Markings";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import { compareSignatures } from "@/lib/signature/signature-comparison";
import { computeSignatureParams } from "@/lib/signature/signature-params";
import {
    createFigurePage,
    createReportRoot,
    createStyles,
} from "../core/dom-utils";
import { withReportI18n } from "../core/i18n-context";
import { renderPagesToPdf } from "../core/pdf-renderer";
import { buildReportIdentity } from "../core/report-identity";
import { getCanvasSprites } from "../core/viewport-context";
import { getImageMeta } from "../rendering/image-meta";
import { renderImageWithMarkings } from "../rendering/pixi-renderer";
import {
    createSignatureCorrelationPage,
    createSignatureCoverPage,
    createSignatureSummaryPage,
} from "./page-builders";
import type { SignatureReportOptions } from "./types";

export const generateSignatureReport = async (
    options: SignatureReportOptions
): Promise<void> => {
    let stage = "init";
    try {
        stage = "check-working-mode";
        if (WorkingModeStore.state.workingMode !== WORKING_MODE.SIGNATURE) {
            throw new Error(
                "Signature report is available only in the signature working mode."
            );
        }

        await withReportI18n(
            options.reportLanguage,
            async ({ tReport, tKeywords }) => {
                stage = "get-sprites";
                const { leftSprite, rightSprite } = getCanvasSprites();

                stage = "compute-params";
                const markingsLeft = MarkingsStore(CANVAS_ID.LEFT).state
                    .markings;
                const markingsRight = MarkingsStore(CANVAS_ID.RIGHT).state
                    .markings;
                const { types } = MarkingTypesStore.state;

                const paramsA = computeSignatureParams(markingsLeft, types);
                const paramsB = computeSignatureParams(markingsRight, types);
                if (!paramsA.hasOutline || !paramsB.hasOutline) {
                    throw new Error(
                        "Draw a signature outline (polygon) on both images before generating the report."
                    );
                }
                const comparison = compareSignatures(paramsA, paramsB);

                stage = "read-image-meta";
                const leftMeta = await getImageMeta(leftSprite, "md5");
                const rightMeta = await getImageMeta(rightSprite, "md5");

                stage = "render-overlays";
                const leftOverlay = await renderImageWithMarkings(
                    leftMeta.bytes,
                    markingsLeft,
                    types,
                    1.6
                );
                const rightOverlay = await renderImageWithMarkings(
                    rightMeta.bytes,
                    markingsRight,
                    types,
                    1.6
                );

                stage = "report-metadata";
                const identity = await buildReportIdentity(
                    options,
                    leftMeta,
                    rightMeta
                );

                stage = "build-dom";
                const root = createReportRoot();
                root.appendChild(createStyles());

                const pages: HTMLElement[] = [];

                const coverPage = createSignatureCoverPage({
                    identity,
                    leftMeta,
                    rightMeta,
                    tReport,
                });
                pages.push(coverPage);

                const { page: summaryPage, correlationText } =
                    createSignatureSummaryPage({
                        paramsA,
                        paramsB,
                        comparison,
                        pageNumber: pages.length + 1,
                        reportId: identity.reportId,
                        tReport,
                        tKeywords,
                    });
                pages.push(summaryPage);

                if (comparison.spearman) {
                    pages.push(
                        createSignatureCorrelationPage(
                            paramsA,
                            paramsB,
                            comparison,
                            correlationText,
                            pages.length + 1,
                            identity.reportId,
                            tReport,
                            tKeywords
                        )
                    );
                }

                pages.push(
                    createFigurePage(
                        tReport("Signature A figure"),
                        leftOverlay.toDataURL("image/png"),
                        `${tReport("Image 1")} (${tReport("Sample A")})`,
                        pages.length + 1,
                        identity.reportId,
                        tReport
                    ),
                    createFigurePage(
                        tReport("Signature B figure"),
                        rightOverlay.toDataURL("image/png"),
                        `${tReport("Image 2")} (${tReport("Sample B")})`,
                        pages.length + 1,
                        identity.reportId,
                        tReport
                    )
                );

                stage = "render-pdf";
                await renderPagesToPdf(
                    root,
                    pages,
                    tKeywords("Generate report"),
                    `signature-report-${identity.reportId}.pdf`
                );
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(
            `[signature-report] failed at ${stage}: ${message}`,
            error
        );
        throw new Error(`Report failed at ${stage}: ${message}`);
    }
};
