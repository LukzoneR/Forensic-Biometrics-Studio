import type { SignatureComparison } from "@/lib/signature/signature-comparison";
import type { SignatureParams } from "@/lib/signature/signature-params";
import { createFooter, createPage, escapeHtml } from "../core/dom-builder";
import type {
    ImageMeta,
    KeywordsT,
    ReportIdentity,
    ReportT,
} from "../core/types";
import { formatBytes } from "../report-utils";

export const NA_KEY = "Not available" as const;

export const formatNullableInt = (value: number | null, na: string): string =>
    value === null ? na : String(Math.round(value));

export const formatNullableFixed2 = (
    value: number | null,
    na: string
): string => (value === null ? na : value.toFixed(2));

export const formatNullablePercent = (
    value: number | null,
    na: string
): string => (value === null ? na : `${value.toFixed(2)} %`);

export const createSignatureCoverPage = (
    identity: ReportIdentity,
    leftMeta: ImageMeta,
    rightMeta: ImageMeta,
    tReport: ReportT
): HTMLDivElement => {
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
        <div class="report-title">${tReport("Signature verification report title")}</div>
        <div class="meta-grid">
            <div>${tReport("Report ID label")} <strong>${reportId}</strong></div>
            <div>${tReport("Report date and time label")} ${reportDateTime}</div>
            <div>${tReport("Performed by label")}</div>
            <div class="meta-block">
                <div>${escapeHtml(performedBy) || "-"}</div>
                <div>${escapeHtml(department) || "-"}</div>
                ${addressHtml}
            </div>
        </div>

        <div class="section-title">${tReport("Software information")}</div>
        <div class="software-grid">
            <div>${tReport("Application name")} Biometrics-Studio</div>
            <div>${tReport("Application version")} ${appVersion}</div>
        </div>

        <div class="section-title">${tReport("Input material")}</div>
        <div class="input-grid">
            <div class="meta-block">
                <div><strong>${tReport("Image 1")} (${tReport("Sample A")}):</strong></div>
                <div>${tReport("File name")} ${escapeHtml(leftMeta.name)}</div>
                <div>${tReport("Image dimensions")} ${leftMeta.width} x ${leftMeta.height} px</div>
                <div>${tReport("Size")} ${formatBytes(leftMeta.sizeBytes)}</div>
                <div>${tReport("Checksum")} ${leftMeta.checksum}</div>
            </div>
            <div class="meta-block">
                <div><strong>${tReport("Image 2")} (${tReport("Sample B")}):</strong></div>
                <div>${tReport("File name")} ${escapeHtml(rightMeta.name)}</div>
                <div>${tReport("Image dimensions")} ${rightMeta.width} x ${rightMeta.height} px</div>
                <div>${tReport("Size")} ${formatBytes(rightMeta.sizeBytes)}</div>
                <div>${tReport("Checksum")} ${rightMeta.checksum}</div>
            </div>
        </div>
        ${createFooter(1, reportId, tReport)}
    `;
    return page;
};

export const createSignatureSummaryPage = (
    paramsA: SignatureParams,
    paramsB: SignatureParams,
    comparison: SignatureComparison,
    pageNumber: number,
    reportId: string,
    tReport: ReportT,
    tKeywords: KeywordsT
): HTMLDivElement => {
    const na = tReport(NA_KEY);
    const fmtInt = (v: number | null) => formatNullableInt(v, na);
    const fmt2 = (v: number | null) => formatNullableFixed2(v, na);
    const fmtPct = (v: number | null) => formatNullablePercent(v, na);

    const paramRows: Array<[string, string, string, string]> = [
        [
            "N",
            tKeywords("Segments count"),
            String(paramsA.segmentCount),
            String(paramsB.segmentCount),
        ],
        [
            "F",
            tKeywords("Outline area"),
            fmtInt(paramsA.area),
            fmtInt(paramsB.area),
        ],
        [
            "P",
            tKeywords("Outline perimeter"),
            fmtInt(paramsA.perimeter),
            fmtInt(paramsB.perimeter),
        ],
        [
            "Wk",
            tKeywords("Shape coefficient"),
            fmt2(paramsA.shapeCoefficient),
            fmt2(paramsB.shapeCoefficient),
        ],
        [
            "W1",
            tKeywords("Axis W1 length"),
            fmtInt(paramsA.w1),
            fmtInt(paramsB.w1),
        ],
        [
            "W2",
            tKeywords("Axis W2 length"),
            fmtInt(paramsA.w2),
            fmtInt(paramsB.w2),
        ],
        [
            "Pw",
            tKeywords("Size proportion"),
            fmt2(paramsA.sizeProportion),
            fmt2(paramsB.sizeProportion),
        ],
        [
            "G",
            tKeywords("Grafotype"),
            fmt2(paramsA.grafotype),
            fmt2(paramsB.grafotype),
        ],
    ];

    const paramRowsHtml = paramRows
        .map(
            ([symbol, label, a, b]) =>
                `<tr><td>${symbol} — ${label}</td><td>${a}</td><td>${b}</td></tr>`
        )
        .join("");

    const { spearman } = comparison;
    const correlationText = spearman
        ? `R = ${spearman.r.toFixed(3)} (Rkr = ${
              spearman.rkr === null ? na : spearman.rkr.toFixed(3)
          }, N = ${spearman.n}, α = 0.05) — ${
              spearman.significant
                  ? tKeywords("significant")
                  : tKeywords("not significant")
          }`
        : na;

    const summaryPage = createPage();
    summaryPage.innerHTML = `
        <div class="section-title">${tReport("Parameters summary")}</div>
        <table class="table">
            <thead>
                <tr>
                    <th>${tKeywords("Parameters")}</th>
                    <th>${tReport("Sample A")}</th>
                    <th>${tReport("Sample B")}</th>
                </tr>
            </thead>
            <tbody>${paramRowsHtml}</tbody>
        </table>
        <div class="counts">
            <div>${tKeywords("Shape coefficient agreement")}: <strong>${fmtPct(comparison.shapeAgreement)}</strong></div>
            <div>${tKeywords("Grafotype agreement")}: <strong>${fmtPct(comparison.grafotypeAgreement)}</strong></div>
            <div>${tKeywords("Rank correlation")}: <strong>${correlationText}</strong></div>
        </div>
        ${createFooter(pageNumber, reportId, tReport)}
    `;
    return summaryPage;
};

export const createSignatureCorrelationPage = (
    paramsA: SignatureParams,
    paramsB: SignatureParams,
    comparison: SignatureComparison,
    pageNumber: number,
    reportId: string,
    tReport: ReportT,
    tKeywords: KeywordsT
): HTMLDivElement => {
    const na = tReport(NA_KEY);
    const { spearman } = comparison;
    const correlationText = spearman
        ? `R = ${spearman.r.toFixed(3)} (Rkr = ${
              spearman.rkr === null ? na : spearman.rkr.toFixed(3)
          }, N = ${spearman.n}, α = 0.05) — ${
              spearman.significant
                  ? tKeywords("significant")
                  : tKeywords("not significant")
          }`
        : na;

    const correlationRows = paramsA.segments
        .map((lengthA, i) => {
            const lengthB = paramsB.segments.at(i) ?? 0;
            const rankA = spearman?.ranksA.at(i) ?? "-";
            const rankB = spearman?.ranksB.at(i) ?? "-";
            return `<tr>
                <td>${i + 1}</td>
                <td>${Math.round(lengthA)}</td>
                <td>${rankA}</td>
                <td>${Math.round(lengthB)}</td>
                <td>${rankB}</td>
            </tr>`;
        })
        .join("");

    const page = createPage();
    page.innerHTML = `
        <div class="section-title">${tReport("Rank correlation analysis")}</div>
        <table class="table">
            <thead>
                <tr>
                    <th>Lp</th>
                    <th>${tReport("Segment length")} A</th>
                    <th>${tReport("Rank")} A</th>
                    <th>${tReport("Segment length")} B</th>
                    <th>${tReport("Rank")} B</th>
                </tr>
            </thead>
            <tbody>${correlationRows}</tbody>
        </table>
        <div class="counts">
            <div>${tKeywords("Rank correlation")}: <strong>${correlationText}</strong></div>
        </div>
        ${createFooter(pageNumber, reportId, tReport)}
    `;
    return page;
};
