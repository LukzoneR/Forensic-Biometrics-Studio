import {
    clamp,
    formatBytes,
    formatReportDateTime,
    getMatchedFeatures,
    getMimeTypeFromName,
    getPairedByLabel,
    md5Bytes,
    md5String,
} from "@/lib/report/report-utils";
import {
    decodeUnicodeEscapes,
    escapeHtml,
    resolveFeatureTypeName,
    toCssColor,
} from "@/lib/report/core/dom-builder";
import type { ReportT } from "@/lib/report/core/types";
import {
    determineInitialSide,
    getFeatureBounds,
} from "@/lib/report/core/callout-placement";
import {
    getAlignmentRotationRad,
    getExpandedCropSizeForRotation,
    getFeatureCropCenter,
    getMarkingDirectionRad,
    normalizeAngleRad,
} from "@/lib/report/core/image-rendering";
import {
    formatNullableFixed2,
    formatNullableInt,
    formatNullablePercent,
} from "@/lib/report/signature/page-builders";
import { groupPairedByPrefix } from "@/lib/report/shoeprint/page-builders";
import type { PairedFeature } from "@/lib/report/shoeprint/types";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import type { MarkingClass } from "@/lib/markings/MarkingClass";
import type { MarkingType } from "@/lib/markings/MarkingType";

describe("Report Utilities & Helpers", () => {
    describe("clamp", () => {
        it("restricts values below min and above max", () => {
            expect(clamp(-5, 0, 10)).toBe(0);
            expect(clamp(15, 0, 10)).toBe(10);
            expect(clamp(5, 0, 10)).toBe(5);
        });
    });

    describe("formatReportDateTime", () => {
        it("formats date with 2-digit padding", () => {
            const date = new Date(2025, 4, 3, 9, 5, 2); // 3 May 2025 09:05:02
            expect(formatReportDateTime(date)).toBe("03.05.2025 - 09:05:02");
        });
    });

    describe("formatBytes", () => {
        it("formats bytes, kilobytes and megabytes", () => {
            expect(formatBytes(500)).toBe("500 B");
            expect(formatBytes(2048)).toBe("2.0 KB");
            expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
            expect(formatBytes(NaN)).toBe("-");
        });
    });

    describe("getMimeTypeFromName", () => {
        it("resolves correct mime types based on extension", () => {
            expect(getMimeTypeFromName("sample.png")).toBe("image/png");
            expect(getMimeTypeFromName("sample.jpg")).toBe("image/jpeg");
            expect(getMimeTypeFromName("sample.jpeg")).toBe("image/jpeg");
            expect(getMimeTypeFromName("sample.webp")).toBe("image/webp");
            expect(getMimeTypeFromName("sample.bmp")).toBe("image/bmp");
            expect(getMimeTypeFromName("sample.unknown")).toBe(
                "application/octet-stream"
            );
        });
    });

    describe("md5 utilities", () => {
        it("computes deterministic md5 for string and bytes", () => {
            const str = "hello world";
            const hash = md5String(str);
            expect(hash).toHaveLength(32);
            expect(hash).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3");

            const bytes = new TextEncoder().encode("hello world");
            expect(md5Bytes(bytes)).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3");
        });
    });

    describe("getMatchedFeatures & getPairedByLabel", () => {
        const createMarking = (
            label: number,
            ids?: string[],
            typeId = "type-1"
        ): MarkingClass =>
            ({
                label,
                ids,
                typeId,
                origin: { x: 10 * label, y: 20 * label },
                markingClass: MARKING_CLASS.POINT,
            }) as unknown as MarkingClass;

        it("matches features by common IDs", () => {
            const left = [
                createMarking(1, ["id-a"]),
                createMarking(2, ["id-b"]),
                createMarking(3, ["id-c"]),
            ];
            const right = [
                createMarking(10, ["id-b"]),
                createMarking(20, ["id-a"]),
                createMarking(30, ["id-z"]),
            ];

            const matched = getMatchedFeatures(left, right);
            expect(matched).toHaveLength(2);
            expect(matched[0]?.left.label).toBe(1);
            expect(matched[0]?.right.label).toBe(20);
            expect(matched[1]?.left.label).toBe(2);
            expect(matched[1]?.right.label).toBe(10);
        });

        it("pairs features by matching label numbers", () => {
            const left = [createMarking(5), createMarking(1), createMarking(9)];
            const right = [
                createMarking(1),
                createMarking(5),
                createMarking(7),
            ];

            const paired = getPairedByLabel(left, right);
            expect(paired).toHaveLength(2);
            expect(paired[0]?.left.label).toBe(1);
            expect(paired[0]?.right.label).toBe(1);
            expect(paired[1]?.left.label).toBe(5);
            expect(paired[1]?.right.label).toBe(5);
        });
    });

    describe("DOM & HTML formatters", () => {
        it("escapes html special characters", () => {
            expect(escapeHtml(`<div>"Hello" & 'World'</div>`)).toBe(
                "&lt;div&gt;&quot;Hello&quot; &amp; &#039;World&#039;&lt;/div&gt;"
            );
        });

        it("converts numeric or string colors to css colors with fallback", () => {
            expect(toCssColor(0xff0000, "#000000")).toBe("#ff0000");
            expect(toCssColor(0x00ff00, "#000000")).toBe("#00ff00");
            expect(toCssColor("#123456", "#000000")).toBe("#123456");
            expect(toCssColor(null, "#fallback")).toBe("#fallback");
            expect(toCssColor("", "#fallback")).toBe("#fallback");
        });

        it("decodes unicode escapes properly", () => {
            expect(decodeUnicodeEscapes("Krak\\u00f3w")).toBe("Kraków");
            expect(decodeUnicodeEscapes("Gda\\u0144sk")).toBe("Gdańsk");
        });

        it("resolves feature type name with fallback", () => {
            const mockT = jest.fn(
                (k: string) => `translated-${k}`
            ) as unknown as ReportT;
            const type = {
                displayName: "Ridge Ending",
                name: "ending",
            } as MarkingType;
            expect(resolveFeatureTypeName(type, mockT)).toBe(
                "translated-Ridge Ending"
            );
            expect(resolveFeatureTypeName(undefined, mockT)).toBe("-");
        });
    });

    describe("Callout Geometry & Placement", () => {
        it("computes bounds accurately across feature origins", () => {
            const features = [
                { origin: { x: 50, y: 100 } },
                { origin: { x: 200, y: 20 } },
                { origin: { x: 10, y: 300 } },
            ] as MarkingClass[];

            const bounds = getFeatureBounds(features, 500, 500);
            expect(bounds).toEqual({
                minX: 10,
                maxX: 200,
                minY: 20,
                maxY: 300,
            });
        });

        it("determines initial callout side from quadrant angle", () => {
            const diag = Math.atan2(100, 100); // 45 deg = ~0.785 rad
            expect(determineInitialSide(0, diag)).toBe("right");
            expect(determineInitialSide(Math.PI / 2, diag)).toBe("bottom");
            expect(determineInitialSide(-Math.PI / 2, diag)).toBe("top");
            expect(determineInitialSide(Math.PI, diag)).toBe("left");
        });
    });

    describe("Image Rendering & Angles", () => {
        it("normalizes angles into (-PI, PI]", () => {
            expect(normalizeAngleRad(0)).toBe(0);
            expect(normalizeAngleRad(3 * Math.PI)).toBeCloseTo(Math.PI);
            expect(normalizeAngleRad(-3 * Math.PI)).toBeCloseTo(Math.PI);
        });

        it("extracts direction angle from ray marking endpoint or angleRad", () => {
            const withAngle = { angleRad: 1.25 } as unknown as MarkingClass;
            expect(getMarkingDirectionRad(withAngle)).toBe(1.25);

            const withEndpoint = {
                origin: { x: 0, y: 0 },
                endpoint: { x: 10, y: 10 },
            } as unknown as MarkingClass;
            expect(getMarkingDirectionRad(withEndpoint)).toBeCloseTo(
                Math.PI / 4
            );
        });

        it("calculates relative alignment rotation between paired markings", () => {
            const left = { angleRad: 1.0 } as unknown as MarkingClass;
            const right = { angleRad: 0.5 } as unknown as MarkingClass;
            expect(getAlignmentRotationRad(left, right)).toBeCloseTo(0.5);
        });

        it("calculates feature crop center", () => {
            const pointMarking = {
                origin: { x: 100, y: 200 },
                markingClass: MARKING_CLASS.POINT,
            } as unknown as MarkingClass;
            expect(getFeatureCropCenter(pointMarking, undefined, 1.0)).toEqual({
                x: 100,
                y: 200,
            });

            const segmentMarking = {
                origin: { x: 10, y: 20 },
                endpoint: { x: 30, y: 40 },
                markingClass: MARKING_CLASS.LINE_SEGMENT,
            } as unknown as MarkingClass;
            expect(
                getFeatureCropCenter(segmentMarking, undefined, 1.0)
            ).toEqual({
                x: 20,
                y: 30,
            });
        });

        it("computes expanded crop size for rotation", () => {
            const size = getExpandedCropSizeForRotation(100, Math.PI / 4);
            expect(size).toBeGreaterThan(100);
            expect(size).toBe(Math.ceil(100 * (Math.SQRT1_2 + Math.SQRT1_2)));
        });
    });

    describe("Signature Report Formatters", () => {
        it("formats nullable numeric values", () => {
            expect(formatNullableInt(42.8, "N/A")).toBe("43");
            expect(formatNullableInt(null, "N/A")).toBe("N/A");

            expect(formatNullableFixed2(3.14159, "N/A")).toBe("3.14");
            expect(formatNullableFixed2(null, "N/A")).toBe("N/A");

            expect(formatNullablePercent(88.543, "N/A")).toBe("88.54 %");
            expect(formatNullablePercent(null, "N/A")).toBe("N/A");
        });
    });

    describe("Shoeprint Helpers", () => {
        it("groups paired features by prefix", () => {
            const markingTypes: MarkingType[] = [
                {
                    id: "t1",
                    displayName: "P: Pattern 1",
                    name: "p1",
                } as MarkingType,
                {
                    id: "t2",
                    displayName: "G: Group 1",
                    name: "g1",
                } as MarkingType,
                {
                    id: "t3",
                    displayName: "P: Pattern 2",
                    name: "p2",
                } as MarkingType,
            ];

            const paired = [
                { id: "1", left: { typeId: "t1" }, right: { typeId: "t1" } },
                { id: "2", left: { typeId: "t2" }, right: { typeId: "t2" } },
                { id: "3", left: { typeId: "t3" }, right: { typeId: "t3" } },
            ] as unknown as PairedFeature[];

            const patternGrouped = groupPairedByPrefix(
                paired,
                markingTypes,
                "P:"
            );
            expect(patternGrouped.size).toBe(2);
            expect(patternGrouped.get("t1")?.pairs).toHaveLength(1);
            expect(patternGrouped.get("t3")?.pairs).toHaveLength(1);

            const groupGrouped = groupPairedByPrefix(
                paired,
                markingTypes,
                "G:"
            );
            expect(groupGrouped.size).toBe(1);
            expect(groupGrouped.get("t2")?.pairs).toHaveLength(1);
        });
    });
});
