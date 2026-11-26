import { PointMarking } from "@/lib/markings/PointMarking";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { MarkingType } from "@/lib/markings/MarkingType";
import {
    getExpandedCropSizeForRotation,
    normalizeAngleRad,
} from "@/lib/report/canvas-utils";
import {
    escapeHtml,
    resolveFeatureTypeName,
    toCssColor,
} from "@/lib/report/dom-utils";
import {
    clamp,
    formatBytes,
    formatReportDateTime,
    getMatchedFeatures,
    getMimeTypeFromName,
    getPairedByLabel,
    md5String,
} from "@/lib/report/report-utils";

describe("report utils & helpers", () => {
    describe("report-utils", () => {
        it("clamps values correctly", () => {
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(-5, 0, 10)).toBe(0);
            expect(clamp(15, 0, 10)).toBe(10);
        });

        it("formats bytes accurately", () => {
            expect(formatBytes(Number.NaN)).toBe("-");
            expect(formatBytes(500)).toBe("500 B");
            expect(formatBytes(2048)).toBe("2.0 KB");
            expect(formatBytes(1048576 * 2.5)).toBe("2.50 MB");
        });

        it("resolves MIME type from filename", () => {
            expect(getMimeTypeFromName("test.png")).toBe("image/png");
            expect(getMimeTypeFromName("test.JPG")).toBe("image/jpeg");
            expect(getMimeTypeFromName("test.webp")).toBe("image/webp");
            expect(getMimeTypeFromName("test.bin")).toBe(
                "application/octet-stream"
            );
        });

        it("formats dates predictably", () => {
            const date = new Date(2025, 4, 12, 14, 5, 9); // 12.05.2025 14:05:09
            expect(formatReportDateTime(date)).toBe("12.05.2025 - 14:05:09");
        });

        it("computes md5 checksum of strings", () => {
            expect(md5String("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
        });

        it("matches paired features by id or label", () => {
            const sampleTypeId = "type-1";
            const pairId = "pair-uuid-1";
            const leftMarking = new PointMarking(
                1,
                { x: 10, y: 20 },
                sampleTypeId,
                [pairId]
            );
            const rightMarking = new PointMarking(
                1,
                { x: 15, y: 25 },
                sampleTypeId,
                [pairId]
            );

            const matchedById = getMatchedFeatures(
                [leftMarking],
                [rightMarking]
            );
            expect(matchedById).toHaveLength(1);
            expect(matchedById[0]?.id).toBe(pairId);

            const pairedByLabel = getPairedByLabel(
                [leftMarking],
                [rightMarking]
            );
            expect(pairedByLabel).toHaveLength(1);
            expect(pairedByLabel[0]?.left.label).toBe(1);
        });
    });

    describe("canvas-utils", () => {
        it("normalizes angles into (-PI, PI]", () => {
            expect(normalizeAngleRad(0)).toBe(0);
            expect(normalizeAngleRad(Math.PI * 3)).toBeCloseTo(Math.PI);
            expect(normalizeAngleRad(-Math.PI * 3)).toBeCloseTo(Math.PI);
        });

        it("computes expanded crop size for rotation", () => {
            const size = 100;
            expect(getExpandedCropSizeForRotation(size, 0)).toBe(100);
            expect(getExpandedCropSizeForRotation(size, Math.PI / 2)).toBe(100);
            expect(
                getExpandedCropSizeForRotation(size, Math.PI / 4)
            ).toBeGreaterThan(100);
        });
    });

    describe("dom-utils", () => {
        it("escapes html characters", () => {
            expect(escapeHtml(`<div>"Hello" & 'World'</div>`)).toBe(
                "&lt;div&gt;&quot;Hello&quot; &amp; &#039;World&#039;&lt;/div&gt;"
            );
        });

        it("converts color values to CSS hex format", () => {
            const fallbackColor = "#000000";
            expect(toCssColor(0xff0000, fallbackColor)).toBe("#ff0000");
            expect(toCssColor("#123456", fallbackColor)).toBe("#123456");
            expect(toCssColor(null, fallbackColor)).toBe(fallbackColor);
        });

        it("resolves feature type names", () => {
            const mockT = ((key: string) => `translated-${key}`) as never;
            const type: MarkingType = {
                id: "1",
                name: "ridge_ending",
                displayName: "Ridge Ending",
                color: "#ff0000",
                size: 5,
                shape: "circle",
                markingClass: MARKING_CLASS.POINT,
            };

            expect(resolveFeatureTypeName(type, mockT)).toBe(
                "translated-Ridge Ending"
            );
            expect(resolveFeatureTypeName(undefined, mockT)).toBe("-");
        });
    });
});
