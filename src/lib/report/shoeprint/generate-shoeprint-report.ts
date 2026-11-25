import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import { MarkingsStore } from "@/lib/stores/Markings";
import { ShoeprintComparisonStore } from "@/lib/stores/ShoeprintComparison";
import { WorkingModeStore } from "@/lib/stores/WorkingMode";
import { WORKING_MODE } from "@/views/selectMode";
import {
    createFigurePage,
    createFooter,
    createPage,
    createReportRoot,
    escapeHtml,
    resolveFeatureTypeName,
    toCssColor,
} from "../core/dom-utils";
import { withReportI18n } from "../core/i18n-context";
import { renderPagesToPdf } from "../core/pdf-renderer";
import { buildReportIdentity } from "../core/report-identity";
import { getCanvasSprites } from "../core/viewport-context";
import {
    cropCanvas,
    getMarkingCenter,
    getMarkingExtent,
} from "../rendering/canvas-utils";
import { getImageMeta } from "../rendering/image-meta";
import { renderImageWithMarkings } from "../rendering/pixi-renderer";
import { formatBytes, getPairedByLabel, toDataUrl } from "../report-utils";
import { createOverviewCalloutImage } from "./callout-placement";
import { createComparisonPages } from "./comparison-pages";
import {
    createCategoryPages,
    createStyles,
    groupPairedByPrefix,
} from "./page-builders";
import {
    IMAGE_CELL_SIZE,
    OVERVIEW_CHUNK_SIZE,
    PREFIX_GROUP,
    PREFIX_PATTERN,
    PREFIX_UNIQUE,
    type ShoeprintReportGenerationOptions,
    UNIQUE_ROWS_PER_PAGE,
} from "./types";

const getTypePrefix = (displayName: string): string => {
    const match = displayName.match(/^([A-Z]+):/);
    return match ? `${match[1]}:` : "";
};

/* eslint-disable sonarjs/cognitive-complexity */
export const generateShoeprintReport = async (
    options: ShoeprintReportGenerationOptions
): Promise<void> => {
    let stage = "init";
    try {
        stage = "check-working-mode";
        const { workingMode } = WorkingModeStore.state;
        if (workingMode !== WORKING_MODE.SHOEPRINT) {
            throw new Error(
                "Report generation is available only for shoeprints."
            );
        }

        await withReportI18n(
            options.reportLanguage,
            async ({ tReport, tKeywords }) => {
                stage = "get-sprites";
                const { leftSprite, rightSprite } = getCanvasSprites();

                stage = "collect-markings";
                const markingsLeft = MarkingsStore(CANVAS_ID.LEFT).state
                    .markings;
                const markingsRight = MarkingsStore(CANVAS_ID.RIGHT).state
                    .markings;
                const markingTypes = MarkingTypesStore.state.types;

                const paired = getPairedByLabel(markingsLeft, markingsRight);

                const reportPaired = paired.filter(p => {
                    const type = markingTypes.find(t => t.id === p.left.typeId);
                    if (!type) return false;
                    const dn = type.displayName ?? type.name ?? "";
                    const prefix = getTypePrefix(dn);
                    return (
                        prefix === PREFIX_PATTERN ||
                        prefix === PREFIX_GROUP ||
                        prefix === PREFIX_UNIQUE
                    );
                });

                const patternGrouped = groupPairedByPrefix(
                    reportPaired,
                    markingTypes,
                    PREFIX_PATTERN
                );
                const groupGrouped = groupPairedByPrefix(
                    reportPaired,
                    markingTypes,
                    PREFIX_GROUP
                );
                const uniquePaired = reportPaired.filter(p => {
                    const type = markingTypes.find(t => t.id === p.left.typeId);
                    const dn = type?.displayName ?? type?.name ?? "";
                    return getTypePrefix(dn) === PREFIX_UNIQUE;
                });

                stage = "read-image-meta";
                const leftMeta = await getImageMeta(leftSprite, "sha256");
                const rightMeta = await getImageMeta(rightSprite, "sha256");

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
                        undefined,
                        { showMarkingLabels: true }
                    ),
                    renderImageWithMarkings(
                        rightMeta.bytes,
                        markingsRight,
                        markingTypes,
                        1.6,
                        undefined,
                        { showMarkingLabels: true }
                    ),
                ]);

                stage = "unique-crops";
                const [leftOrigCanvas, rightOrigCanvas] = await Promise.all([
                    renderImageWithMarkings(
                        leftMeta.bytes,
                        [],
                        markingTypes,
                        1.6
                    ),
                    renderImageWithMarkings(
                        rightMeta.bytes,
                        [],
                        markingTypes,
                        1.6
                    ),
                ]);

                const BATCH_SIZE = 4;
                const uniqueCrops: Array<{
                    leftWith: string;
                    rightWith: string;
                    leftOrig: string;
                    rightOrig: string;
                }> = [];

                for (let i = 0; i < uniquePaired.length; i += BATCH_SIZE) {
                    const batch = uniquePaired.slice(i, i + BATCH_SIZE);
                    // eslint-disable-next-line no-await-in-loop
                    const batchResults = await Promise.all(
                        batch.map(async feature => {
                            const [leftWithCanvas, rightWithCanvas] =
                                await Promise.all([
                                    renderImageWithMarkings(
                                        leftMeta.bytes,
                                        [feature.left],
                                        markingTypes,
                                        1.6,
                                        undefined,
                                        {
                                            showMarkingLabels: false,
                                            markingsAlpha: 0.45,
                                        }
                                    ),
                                    renderImageWithMarkings(
                                        rightMeta.bytes,
                                        [feature.right],
                                        markingTypes,
                                        1.6,
                                        undefined,
                                        {
                                            showMarkingLabels: false,
                                            markingsAlpha: 0.45,
                                        }
                                    ),
                                ]);

                            const leftCenter = getMarkingCenter(feature.left);
                            const rightCenter = getMarkingCenter(feature.right);
                            const leftExtent = getMarkingExtent(feature.left);
                            const rightExtent = getMarkingExtent(feature.right);
                            const maxExtent = Math.max(leftExtent, rightExtent);
                            const targetSize = Math.max(
                                60,
                                Math.min(
                                    IMAGE_CELL_SIZE,
                                    Math.round(maxExtent / 0.7)
                                )
                            );

                            const leftWith = cropCanvas(
                                leftWithCanvas,
                                leftCenter.x,
                                leftCenter.y,
                                targetSize
                            );
                            const rightWith = cropCanvas(
                                rightWithCanvas,
                                rightCenter.x,
                                rightCenter.y,
                                targetSize
                            );
                            const leftOrig = cropCanvas(
                                leftOrigCanvas,
                                leftCenter.x,
                                leftCenter.y,
                                targetSize
                            );
                            const rightOrig = cropCanvas(
                                rightOrigCanvas,
                                rightCenter.x,
                                rightCenter.y,
                                targetSize
                            );

                            return {
                                leftWith: leftWith.toDataURL("image/png"),
                                rightWith: rightWith.toDataURL("image/png"),
                                leftOrig: leftOrig.toDataURL("image/png"),
                                rightOrig: rightOrig.toDataURL("image/png"),
                            };
                        })
                    );
                    uniqueCrops.push(...batchResults);
                }

                stage = "report-metadata";
                const identity = await buildReportIdentity(
                    options,
                    leftMeta,
                    rightMeta
                );

                stage = "build-dom";
                const root = createReportRoot();
                root.appendChild(createStyles());

                const addressHtml =
                    identity.address.length > 0
                        ? identity.address
                              .map(line => `<div>${escapeHtml(line)}</div>`)
                              .join("")
                        : "<div>-</div>";

                const page1 = createPage();
                page1.innerHTML = `
                <div class="report-title">${escapeHtml(
                    options.reportTitle?.trim() ||
                        tReport("Shoeprint report title")
                )}</div>

                <div class="meta-block">
                    <div class="meta-row"><span class="meta-label">${tReport(
                        "Report ID label"
                    )}</span><span>${identity.reportId}</span></div>
                    <div class="meta-row"><span class="meta-label">${tReport(
                        "Report date and time label"
                    )}</span><span>${identity.reportDateTime}</span></div>
                </div>

                <div class="meta-block">
                    <div style="font-weight:700;font-size:11px;margin-bottom:3px;">${tReport(
                        "Performed by label"
                    )}</div>
                    <div style="font-size:11px;">${escapeHtml(
                        identity.performedBy
                    )}</div>
                    <div style="font-size:11px;">${escapeHtml(
                        identity.department
                    )}</div>
                    ${addressHtml}
                </div>

                <div class="section-title">${tReport(
                    "Software information"
                )}</div>
                <div class="software-grid">
                    <div class="software-row"><span class="software-label">${tReport(
                        "Application name"
                    )}</span><span>Biometrics-Studio</span></div>
                    <div class="software-row"><span class="software-label">${tReport(
                        "Application version"
                    )}</span><span>${identity.appVersion}</span></div>
                </div>

                <div class="section-title">${tReport("Input material")}</div>
                <div class="input-stack">
                    <div class="input-block-title">${tReport("Image 1")}:</div>
                    <div class="input-row"><span class="input-label">${tReport(
                        "File name"
                    )}</span><span>${escapeHtml(leftMeta.name)}</span></div>
                    <div class="input-row"><span class="input-label">${tReport(
                        "Image dimensions"
                    )}</span><span>${leftMeta.width} x ${leftMeta.height} px</span></div>
                    <div class="input-row"><span class="input-label">${tReport(
                        "Size"
                    )}</span><span>${formatBytes(leftMeta.sizeBytes)}</span></div>
                    <div class="input-row"><span class="input-label">${tReport(
                        "Checksum"
                    )}</span><span>${leftMeta.checksum}</span></div>
                </div>
                <div class="input-stack">
                    <div class="input-block-title">${tReport("Image 2")}:</div>
                    <div class="input-row"><span class="input-label">${tReport(
                        "File name"
                    )}</span><span>${escapeHtml(rightMeta.name)}</span></div>
                    <div class="input-row"><span class="input-label">${tReport(
                        "Image dimensions"
                    )}</span><span>${rightMeta.width} x ${rightMeta.height} px</span></div>
                    <div class="input-row"><span class="input-label">${tReport(
                        "Size"
                    )}</span><span>${formatBytes(rightMeta.sizeBytes)}</span></div>
                    <div class="input-row"><span class="input-label">${tReport(
                        "Checksum"
                    )}</span><span>${rightMeta.checksum}</span></div>
                </div>

                <div class="counts">
                    <div class="input-row"><span class="input-label">${tReport(
                        "Shoeprint paired features count"
                    )}</span><span>${reportPaired.length}</span></div>
                </div>

                <div class="note">
                    <div class="note-title">${tReport("Note title")}</div>
                    <div>${tReport("Note body")}</div>
                </div>

                ${createFooter(1, identity.reportId, tReport)}
                `;

                const pages: HTMLElement[] = [page1];

                pages.push(
                    createFigurePage(
                        tReport("Figure 1"),
                        leftOriginal,
                        tReport("Image 1 label"),
                        2,
                        identity.reportId,
                        tReport
                    ),
                    createFigurePage(
                        tReport("Figure 2"),
                        leftAllCanvas.toDataURL("image/png"),
                        tReport("Image 1 label"),
                        3,
                        identity.reportId,
                        tReport
                    ),
                    createFigurePage(
                        tReport("Shoeprint figure 3"),
                        rightOriginal,
                        tReport("Image 2 label"),
                        4,
                        identity.reportId,
                        tReport
                    ),
                    createFigurePage(
                        tReport("Shoeprint figure 4"),
                        rightAllCanvas.toDataURL("image/png"),
                        tReport("Image 2 label"),
                        5,
                        identity.reportId,
                        tReport
                    )
                );

                const patternPages = await createCategoryPages(
                    patternGrouped,
                    leftMeta,
                    rightMeta,
                    markingTypes,
                    tReport("Shoeprint pattern features title"),
                    pages.length + 1,
                    identity.reportId,
                    tReport
                );
                patternPages.forEach(p => pages.push(p));

                const groupPages = await createCategoryPages(
                    groupGrouped,
                    leftMeta,
                    rightMeta,
                    markingTypes,
                    tReport("Shoeprint group features title"),
                    pages.length + 1,
                    identity.reportId,
                    tReport
                );
                groupPages.forEach(p => pages.push(p));

                if (uniquePaired.length > 0) {
                    const calloutColor =
                        options.uniqueColor === "green" ? "#2ecc71" : "#cc0000";

                    for (
                        let i = 0;
                        i < uniquePaired.length;
                        i += OVERVIEW_CHUNK_SIZE
                    ) {
                        const chunk = uniquePaired.slice(
                            i,
                            i + OVERVIEW_CHUNK_SIZE
                        );
                        // eslint-disable-next-line no-await-in-loop
                        const [leftOverview, rightOverview] = await Promise.all(
                            [
                                createOverviewCalloutImage(
                                    leftMeta.bytes,
                                    chunk.map(x => x.left),
                                    calloutColor
                                ),
                                createOverviewCalloutImage(
                                    rightMeta.bytes,
                                    chunk.map(x => x.right),
                                    calloutColor
                                ),
                            ]
                        );
                        const overviewPage = createPage();
                        overviewPage.innerHTML = `
                            <div class="category-title">${tReport(
                                "Shoeprint comparative table overview"
                            )}</div>
                            <div class="overview-grid">
                                <div class="fig"><img src="${leftOverview}" alt="Left overview" /></div>
                                <div class="fig"><img src="${rightOverview}" alt="Right overview" /></div>
                            </div>
                            ${createFooter(
                                pages.length + 1,
                                identity.reportId,
                                tReport
                            )}
                        `;
                        pages.push(overviewPage);
                    }

                    uniquePaired.forEach((feature, idx) => {
                        const isNewPage = idx % UNIQUE_ROWS_PER_PAGE === 0;
                        if (isNewPage) {
                            const detailPage = createPage();
                            detailPage.innerHTML = `
                                <div class="section-title">${tReport(
                                    "Shoeprint comparative table details"
                                )}</div>
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
                                ${createFooter(
                                    pages.length + 1,
                                    identity.reportId,
                                    tReport
                                )}
                            `;
                            pages.push(detailPage);
                        }

                        const targetPage = pages[pages.length - 1];
                        if (!targetPage) return;

                        const tableBody = targetPage.querySelector(
                            "tbody"
                        ) as HTMLTableSectionElement | null;
                        if (!tableBody) return;

                        const featureTypeDefinition = markingTypes.find(
                            t => t.id === feature.left.typeId
                        );
                        const featureType = resolveFeatureTypeName(
                            featureTypeDefinition,
                            tReport
                        );
                        const markerRing = toCssColor(
                            featureTypeDefinition?.backgroundColor,
                            "#c0392b"
                        );
                        const crop = uniqueCrops.at(idx);
                        if (!crop) return;

                        const row1 = document.createElement("tr");
                        row1.innerHTML = `
                            <td rowspan="2">
                                <div class="feature-cell">
                                    <div class="feature-label" style="color: ${markerRing};">${escapeHtml(
                                        String(feature.left.label)
                                    )}</div>
                                    <div class="feature-type">${tReport(
                                        "Feature type"
                                    )}:<br/><strong>${escapeHtml(
                                        featureType
                                    )}</strong></div>
                                </div>
                            </td>
                            <td><img class="feature-image" src="${crop.leftWith}" alt="${escapeHtml(featureType)} (left)" /></td>
                            <td><img class="feature-image" src="${crop.rightWith}" alt="${escapeHtml(featureType)} (right)" /></td>
                        `;
                        tableBody.appendChild(row1);

                        const row2 = document.createElement("tr");
                        row2.innerHTML = `
                            <td><img class="feature-image" src="${crop.leftOrig}" alt="${escapeHtml(featureType)} original (left)" /></td>
                            <td><img class="feature-image" src="${crop.rightOrig}" alt="${escapeHtml(featureType)} original (right)" /></td>
                        `;
                        tableBody.appendChild(row2);
                    });
                } else {
                    const noUniquePage = createPage();
                    noUniquePage.innerHTML = `
                        <div class="section-title">${tReport(
                            "Shoeprint comparative table overview"
                        )}</div>
                        <div style="font-size:12px; margin-top: 16px;">${tReport(
                            "Shoeprint no unique features"
                        )}</div>
                        ${createFooter(
                            pages.length + 1,
                            identity.reportId,
                            tReport
                        )}
                    `;
                    pages.push(noUniquePage);
                }

                stage = "build-comparison";
                const comparisonRun = ShoeprintComparisonStore.state.run;
                if (options.includeComparison && comparisonRun) {
                    createComparisonPages(
                        comparisonRun,
                        pages.length + 1,
                        identity.reportId,
                        tReport,
                        tKeywords
                    ).forEach(page => pages.push(page));
                }

                stage = "render-pdf";
                await renderPagesToPdf(
                    root,
                    pages,
                    tKeywords("Generate report"),
                    `shoeprint-report-${identity.reportId}.pdf`
                );
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(
            `[shoeprint-report] failed at ${stage}: ${message}`,
            error
        );
        throw new Error(`Shoeprint report failed at ${stage}: ${message}`);
    }
};
/* eslint-enable sonarjs/cognitive-complexity */
