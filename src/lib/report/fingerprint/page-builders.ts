import type { MarkingType } from "@/lib/markings/MarkingType";
import {
    createFooter,
    createLandscapePage,
    createPage,
    escapeHtml,
    resolveFeatureTypeName,
    toCssColor,
} from "../core/dom-builder";
import type {
    ImageMeta,
    MatchedFeature,
    ReportIdentity,
    ReportT,
} from "../core/types";
import { formatBytes } from "../report-utils";
import type { FeatureCropPair } from "./types";

export type CoverPageData = {
    identity: ReportIdentity;
    leftMeta: ImageMeta;
    rightMeta: ImageMeta;
    matchedCount: number;
    selectedCount: number;
};

export const createFingerprintCoverPage = (
    data: CoverPageData,
    tReport: ReportT
): HTMLDivElement => {
    const { identity, leftMeta, rightMeta, matchedCount, selectedCount } = data;
    const {
        reportId,
        reportDateTime,
        performedBy,
        department,
        address,
        appVersion,
    } = identity;

    const addressHtml =
        address.length > 0
            ? address.map(line => `<div>${escapeHtml(line)}</div>`).join("")
            : "<div>-</div>";

    const page = createPage();
    page.innerHTML = `
        <div class="report-title">${tReport("Technical report title")}</div>

        <div class="kv-row">
            <div class="kv-label">${tReport("Report ID label")}</div>
            <div class="kv-value"><strong>${reportId}</strong></div>
        </div>
        <div class="kv-row">
            <div class="kv-label">${tReport("Report date and time label")}</div>
            <div class="kv-value">${reportDateTime}</div>
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
            <div class="kv-value">${appVersion}</div>
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
    return page;
};

export const createFingerprintOverviewPage = (
    leftOverview: string,
    rightOverview: string,
    chunkIndex: number,
    totalChunks: number,
    pageNumber: number,
    reportId: string,
    tReport: ReportT
): HTMLDivElement => {
    const page = createLandscapePage();
    const overviewTitle =
        totalChunks > 1
            ? `${tReport("Comparative table overview")} (${chunkIndex + 1}/${totalChunks})`
            : tReport("Comparative table overview");

    page.innerHTML = `
        <div class="section-title">${overviewTitle}</div>
        <div class="overview-grid landscape">
            <img src="${leftOverview}" alt="Left overview" />
            <img src="${rightOverview}" alt="Right overview" />
        </div>
        ${createFooter(pageNumber, reportId, tReport)}
    `;
    return page;
};

export const createFingerprintDetailPage = (
    chunkIndex: number,
    totalChunks: number,
    pageNumber: number,
    reportId: string,
    tReport: ReportT
): HTMLDivElement => {
    const page = createPage();
    const detailTitle =
        totalChunks > 1
            ? `${tReport("Comparative table details")} (${chunkIndex + 1}/${totalChunks})`
            : tReport("Comparative table details");

    page.innerHTML = `
        <div class="section-title">${detailTitle}</div>
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
        ${createFooter(pageNumber, reportId, tReport)}
    `;
    return page;
};

export const createFingerprintDetailRow = (
    feature: MatchedFeature,
    crop: FeatureCropPair,
    markingTypes: MarkingType[],
    tReport: ReportT
): HTMLTableRowElement => {
    const featureTypeDefinition = markingTypes.find(
        type => type.id === feature.left.typeId
    );
    const featureType = resolveFeatureTypeName(featureTypeDefinition, tReport);
    const escapedFeatureType = escapeHtml(featureType);
    const markerRing = toCssColor(
        featureTypeDefinition?.backgroundColor,
        "#cc0000"
    );
    const markerOutline = toCssColor(
        featureTypeDefinition?.textColor,
        "#7a0000"
    );

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
        <td><img class="feature-image" src="${crop.left}" alt="${escapedFeatureType} (left)" /></td>
        <td><img class="feature-image" src="${crop.right}" alt="${escapedFeatureType} (right)" /></td>
    `;
    return row;
};
