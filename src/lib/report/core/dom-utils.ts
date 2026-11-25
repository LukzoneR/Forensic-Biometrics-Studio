import { MarkingType } from "@/lib/markings/MarkingType";
import { IMAGE_CELL_SIZE, LANDSCAPE, PAGE } from "./constants";
import { REPORT_PDF_CSS } from "./report-styles";
import type { ReportT } from "./types";

export const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

export const toCssColor = (value: unknown, fallback: string): string => {
    if (typeof value === "number" && Number.isFinite(value)) {
        // eslint-disable-next-line no-bitwise
        return `#${(value >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        return value;
    }
    return fallback;
};

export const createPage = (additionalClass?: string): HTMLDivElement => {
    const page = document.createElement("div");
    page.className = additionalClass
        ? `report-page ${additionalClass}`
        : "report-page";
    return page;
};

export const createLandscapePage = (): HTMLDivElement =>
    createPage("landscape");

export const createReportRoot = (): HTMLDivElement => {
    const root = document.createElement("div");
    root.className = "report-root";
    return root;
};

export const createStyles = (extraCss?: string): HTMLStyleElement => {
    const style = document.createElement("style");
    style.textContent = `
        ${REPORT_PDF_CSS}
        .report-root { width: ${PAGE.width}px; }
        .report-page { width: ${PAGE.width}px; height: ${PAGE.height}px; }
        .report-page.landscape { width: ${LANDSCAPE.width}px; height: ${LANDSCAPE.height}px; }
        .feature-image { width: ${IMAGE_CELL_SIZE}px; height: ${IMAGE_CELL_SIZE}px; }
        ${extraCss ?? ""}
    `;
    return style;
};

export const resolveFeatureTypeName = (
    featureTypeDefinition: MarkingType | undefined,
    tReport: ReportT
): string => {
    if (!featureTypeDefinition) return "-";

    const baseName =
        featureTypeDefinition.displayName?.trim() ||
        featureTypeDefinition.name?.trim() ||
        "-";

    return tReport(baseName as never, { defaultValue: baseName });
};

export const createFooter = (
    pageNumber: number,
    reportId: string,
    tReport: ReportT
): string => `
    <div class="footer">
        <div>${tReport("Page")} ${pageNumber}</div>
        <div>${tReport("Report ID label")} ${reportId}</div>
    </div>
`;

export const createFigurePage = (
    title: string,
    image: string,
    imageLabel: string,
    pageNumber: number,
    reportId: string,
    tReport: ReportT
): HTMLDivElement => {
    const page = createPage();
    page.innerHTML = `
        <div class="meta-block">${imageLabel}</div>
        <div class="fig">
            <img src="${image}" alt="${imageLabel}" />
        </div>
        <div class="section-title">${title}</div>
        ${createFooter(pageNumber, reportId, tReport)}
    `;
    return page;
};
