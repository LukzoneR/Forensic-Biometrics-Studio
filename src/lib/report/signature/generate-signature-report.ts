import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { compareSignatures } from "@/lib/signature/signature-comparison";
import { computeSignatureParams } from "@/lib/signature/signature-params";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { MarkingsStore } from "@/lib/stores/Markings";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import {
    createFigurePage,
    createReportRoot,
    createStyles,
} from "../core/dom-builder";
import { buildReportIdentity } from "../core/identity";
import { renderImageWithMarkings } from "../core/image-rendering";
import { renderPagesToPdf } from "../core/pdf-renderer";
import { runWithReportContext } from "../core/report-context";
import { getImageMeta, getReportSprites } from "../core/viewport-loader";
import {
    createSignatureCorrelationPage,
    createSignatureCoverPage,
    createSignatureSummaryPage,
} from "./page-builders";
import type { SignatureReportOptions } from "./types";

export const generateSignatureReportPdfWithDialog = async (
    options: SignatureReportOptions
): Promise<void> => {
    const defaultLanguage =
        options.reportLanguage || GlobalSettingsStore.state.settings.language;

    await runWithReportContext(
        { reportLanguage: defaultLanguage, logPrefix: "signature-report" },
        async ({ tReport, tKeywords, setStage }) => {
            setStage("check-working-mode");
            if (WorkingModeStore.state.workingMode !== WORKING_MODE.SIGNATURE) {
                throw new Error(
                    "Signature report is available only in the signature working mode."
                );
            }

            setStage("get-sprites");
            const { leftSprite, rightSprite } = getReportSprites();

            setStage("compute-params");
            const markingsLeft = MarkingsStore(CANVAS_ID.LEFT).state.markings;
            const markingsRight = MarkingsStore(CANVAS_ID.RIGHT).state.markings;
            const { types } = MarkingTypesStore.state;
            const paramsA = computeSignatureParams(markingsLeft, types);
            const paramsB = computeSignatureParams(markingsRight, types);
            if (!paramsA.hasOutline || !paramsB.hasOutline) {
                throw new Error(
                    "Draw a signature outline (polygon) on both images before generating the report."
                );
            }
            const comparison = compareSignatures(paramsA, paramsB);

            setStage("read-image-meta");
            const leftMeta = await getImageMeta(leftSprite);
            const rightMeta = await getImageMeta(rightSprite);

            setStage("render-overlays");
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

            const coverPage = createSignatureCoverPage(
                identity,
                leftMeta,
                rightMeta,
                tReport
            );
            pages.push(coverPage);

            const summaryPage = createSignatureSummaryPage(
                paramsA,
                paramsB,
                comparison,
                pages.length + 1,
                reportId,
                tReport,
                tKeywords
            );
            pages.push(summaryPage);

            if (comparison.spearman) {
                const correlationPage = createSignatureCorrelationPage(
                    paramsA,
                    paramsB,
                    comparison,
                    pages.length + 1,
                    reportId,
                    tReport,
                    tKeywords
                );
                pages.push(correlationPage);
            }

            pages.push(
                createFigurePage(
                    tReport("Signature A figure"),
                    leftOverlay.toDataURL("image/png"),
                    `${tReport("Image 1")} (${tReport("Sample A")})`,
                    pages.length + 1,
                    reportId,
                    tReport
                )
            );
            pages.push(
                createFigurePage(
                    tReport("Signature B figure"),
                    rightOverlay.toDataURL("image/png"),
                    `${tReport("Image 2")} (${tReport("Sample B")})`,
                    pages.length + 1,
                    reportId,
                    tReport
                )
            );

            setStage("render-pdf");
            await renderPagesToPdf(
                root,
                pages,
                tKeywords("Generate report"),
                `signature-report-${reportId}.pdf`
            );
        }
    );
};
