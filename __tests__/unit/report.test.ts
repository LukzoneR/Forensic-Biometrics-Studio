import { MarkingType } from "@/lib/markings/MarkingType";
import { PointMarking } from "@/lib/markings/PointMarking";
import { RayMarking } from "@/lib/markings/RayMarking";
import {
    createFooter,
    createLandscapePage,
    createPage,
    escapeHtml,
    resolveFeatureTypeName,
    toCssColor,
} from "@/lib/report/core/dom-utils";
import { decodeUnicodeEscapes } from "@/lib/report/core/report-identity";
import { type ReportT } from "@/lib/report/core/types";
import { getFeatureCropCenter } from "@/lib/report/fingerprint/crop-helpers";
import {
    balanceSides,
    determineInitialSide,
    getFeatureBounds,
    getInitialPlacement,
} from "@/lib/report/rendering/callout-placement";
import {
    getAlignmentRotationRad,
    getExpandedCropSizeForRotation,
    getMarkingCenter,
    getMarkingDirectionRad,
    getMarkingExtent,
    normalizeAngleRad,
} from "@/lib/report/rendering/canvas-utils";
import {
    clamp,
    formatBytes,
    formatReportDateTime,
    getMatchedFeatures,
    getMimeTypeFromName,
    getPairedByLabel,
    md5String,
} from "@/lib/report/report-utils";

describe("Report Utilities & Formatting", () => {
    describe("clamp", () => {
        it("clamps value within min and max", () => {
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(-5, 0, 10)).toBe(0);
            expect(clamp(15, 0, 10)).toBe(10);
        });
    });

    describe("formatBytes", () => {
        it("returns '-' for non-finite values", () => {
            expect(formatBytes(NaN)).toBe("-");
            expect(formatBytes(Infinity)).toBe("-");
        });

        it("formats bytes, KB, and MB", () => {
            expect(formatBytes(500)).toBe("500 B");
            expect(formatBytes(1024)).toBe("1.0 KB");
            expect(formatBytes(1536)).toBe("1.5 KB");
            expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.50 MB");
        });
    });

    describe("formatReportDateTime", () => {
        it("formats date as dd.mm.yyyy - hh:mm:ss with zero-padding", () => {
            const date = new Date(2026, 4, 9, 8, 5, 2);
            expect(formatReportDateTime(date)).toBe("09.05.2026 - 08:05:02");
        });
    });

    describe("getMimeTypeFromName", () => {
        it("resolves correct MIME types based on file extension", () => {
            expect(getMimeTypeFromName("test.png")).toBe("image/png");
            expect(getMimeTypeFromName("sample.JPG")).toBe("image/jpeg");
            expect(getMimeTypeFromName("photo.jpeg")).toBe("image/jpeg");
            expect(getMimeTypeFromName("image.webp")).toBe("image/webp");
            expect(getMimeTypeFromName("icon.bmp")).toBe("image/bmp");
            expect(getMimeTypeFromName("anim.gif")).toBe("image/gif");
            expect(getMimeTypeFromName("unknown.dat")).toBe(
                "application/octet-stream"
            );
        });
    });

    describe("md5String", () => {
        it("produces a valid 32-character hex hash", () => {
            const hash = md5String("forensic-biometrics");
            expect(hash).toHaveLength(32);
            expect(hash).toMatch(/^[0-9a-f]{32}$/);
            expect(md5String("forensic-biometrics")).toBe(hash);
        });
    });

    describe("Feature Matching", () => {
        const sharedId = "shared-uuid-1";
        const typeId = "type-1";

        it("matches features by shared ID via getMatchedFeatures", () => {
            const left = [
                new PointMarking(1, { x: 10, y: 10 }, typeId, [sharedId]),
                new PointMarking(2, { x: 20, y: 20 }, typeId, ["left-only"]),
            ];
            const right = [
                new PointMarking(5, { x: 15, y: 15 }, typeId, [sharedId]),
                new PointMarking(6, { x: 25, y: 25 }, typeId, ["right-only"]),
            ];

            const matched = getMatchedFeatures(left, right);
            expect(matched).toHaveLength(1);
            expect(matched[0]?.left.label).toBe(1);
            expect(matched[0]?.right.label).toBe(5);
            expect(matched[0]?.id).toBe(sharedId);
        });

        it("pairs features by identical label via getPairedByLabel", () => {
            const left = [
                new PointMarking(1, { x: 10, y: 10 }, typeId),
                new PointMarking(2, { x: 20, y: 20 }, typeId),
                new PointMarking(3, { x: 30, y: 30 }, typeId),
            ];
            const right = [
                new PointMarking(2, { x: 25, y: 25 }, typeId),
                new PointMarking(1, { x: 15, y: 15 }, typeId),
                new PointMarking(4, { x: 45, y: 45 }, typeId),
            ];

            const paired = getPairedByLabel(left, right);
            expect(paired).toHaveLength(2);
            expect(paired[0]?.left.label).toBe(1);
            expect(paired[0]?.right.label).toBe(1);
            expect(paired[1]?.left.label).toBe(2);
            expect(paired[1]?.right.label).toBe(2);
        });
    });
});

describe("DOM & Presentation Utils", () => {
    describe("escapeHtml", () => {
        it("escapes special HTML entities", () => {
            expect(escapeHtml(`<div>"Hello" & 'World' <script></div>`)).toBe(
                `&lt;div&gt;&quot;Hello&quot; &amp; &#039;World&#039; &lt;script&gt;&lt;/div&gt;`
            );
        });
    });

    describe("toCssColor", () => {
        it("converts hex integers to css hex strings", () => {
            expect(toCssColor(0xff0000, "#000000")).toBe("#ff0000");
            expect(toCssColor(0x00ff00, "#000000")).toBe("#00ff00");
            expect(toCssColor(0x0000ff, "#000000")).toBe("#0000ff");
        });

        it("returns string color as-is when non-empty", () => {
            expect(toCssColor("rgba(255,0,0,0.5)", "#000000")).toBe(
                "rgba(255,0,0,0.5)"
            );
            expect(toCssColor("#123456", "#000000")).toBe("#123456");
        });

        it("returns fallback for invalid values", () => {
            expect(toCssColor(null, "#fallback")).toBe("#fallback");
            expect(toCssColor("", "#fallback")).toBe("#fallback");
            expect(toCssColor(NaN, "#fallback")).toBe("#fallback");
        });
    });

    describe("createPage and createLandscapePage", () => {
        it("creates portrait page element", () => {
            const page = createPage();
            expect(page.className).toBe("report-page");
        });

        it("creates landscape page element", () => {
            const page = createLandscapePage();
            expect(page.className).toBe("report-page landscape");
        });
    });

    describe("createFooter", () => {
        it("creates footer with translated page and report ID", () => {
            const mockT: ReportT = ((key: string) => key) as never;
            const footerHtml = createFooter(3, "test-report-id", mockT);
            expect(footerHtml).toContain("Page 3");
            expect(footerHtml).toContain("Report ID label test-report-id");
        });
    });

    describe("resolveFeatureTypeName", () => {
        it("returns '-' when definition is undefined", () => {
            const mockT: ReportT = ((key: string) => key) as never;
            expect(resolveFeatureTypeName(undefined, mockT)).toBe("-");
        });

        it("translates displayName or name", () => {
            const mockT: ReportT = ((key: string) => `[${key}]`) as never;
            const type = {
                id: "1",
                displayName: "Bifurcation",
                name: "bifurcation",
            } as MarkingType;
            expect(resolveFeatureTypeName(type, mockT)).toBe("[Bifurcation]");
        });
    });

    describe("decodeUnicodeEscapes", () => {
        it("decodes unicode escape sequences correctly", () => {
            expect(decodeUnicodeEscapes("Krak\\u00f3w, Ma\\u0142opolska")).toBe(
                "Kraków, Małopolska"
            );
            expect(decodeUnicodeEscapes("Regular text")).toBe("Regular text");
        });
    });
});

describe("Canvas & Geometry Utils", () => {
    describe("normalizeAngleRad", () => {
        it("normalizes angle to (-PI, PI]", () => {
            expect(normalizeAngleRad(0)).toBe(0);
            expect(normalizeAngleRad(Math.PI)).toBeCloseTo(Math.PI);
            expect(normalizeAngleRad(3 * Math.PI)).toBeCloseTo(Math.PI);
            expect(normalizeAngleRad(-3 * Math.PI)).toBeCloseTo(Math.PI);
            expect(normalizeAngleRad(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
        });
    });

    describe("getMarkingDirectionRad", () => {
        it("extracts direction from ray marking angle", () => {
            const ray = new RayMarking(1, { x: 0, y: 0 }, "type-1", 1.25);
            expect(getMarkingDirectionRad(ray)).toBe(1.25);
        });

        it("extracts direction from endpoint vector", () => {
            const withEndpoint = Object.assign(
                new PointMarking(1, { x: 0, y: 0 }, "type-1"),
                { endpoint: { x: 10, y: 10 } }
            );
            expect(getMarkingDirectionRad(withEndpoint)).toBeCloseTo(
                Math.PI / 4
            );
        });

        it("returns null when no angle or endpoint is present", () => {
            const point = new PointMarking(1, { x: 0, y: 0 }, "type-1");
            expect(getMarkingDirectionRad(point)).toBeNull();
        });
    });

    describe("getAlignmentRotationRad", () => {
        it("calculates rotation angle between two ray markings", () => {
            const ray1 = new RayMarking(1, { x: 0, y: 0 }, "type-1", 0);
            const ray2 = new RayMarking(
                1,
                { x: 0, y: 0 },
                "type-1",
                Math.PI / 2
            );
            const rotation = getAlignmentRotationRad(ray1, ray2);
            expect(rotation).toBeCloseTo(-Math.PI / 2);
        });
    });

    describe("getExpandedCropSizeForRotation", () => {
        it("returns target size when rotation is 0", () => {
            expect(getExpandedCropSizeForRotation(200, 0)).toBe(200);
        });

        it("returns diagonal size when rotated 45 degrees", () => {
            const expanded = getExpandedCropSizeForRotation(100, Math.PI / 4);
            expect(expanded).toBe(Math.ceil(100 * Math.SQRT2));
        });
    });

    describe("getMarkingCenter and getMarkingExtent", () => {
        it("calculates center for point marking", () => {
            const point = new PointMarking(1, { x: 50, y: 60 }, "type-1");
            expect(getMarkingCenter(point)).toEqual({ x: 50, y: 60 });
            expect(getMarkingExtent(point)).toBe(20);
        });

        it("calculates center and extent for marking with endpoint", () => {
            const markingWithEndpoint = Object.assign(
                new PointMarking(1, { x: 10, y: 10 }, "type-1"),
                { endpoint: { x: 30, y: 50 } }
            );
            expect(getMarkingCenter(markingWithEndpoint)).toEqual({
                x: 20,
                y: 30,
            });
            expect(getMarkingExtent(markingWithEndpoint)).toBe(40);
        });
    });

    describe("getFeatureCropCenter", () => {
        it("returns origin for simple point marking", () => {
            const point = new PointMarking(1, { x: 40, y: 70 }, "type-1");
            expect(getFeatureCropCenter(point, undefined, 1.6)).toEqual({
                x: 40,
                y: 70,
            });
        });

        it("calculates midpoint for ray marking", () => {
            const ray = new RayMarking(1, { x: 100, y: 100 }, "type-1", 0);
            const type = { id: "type-1", size: 10 } as MarkingType;
            const center = getFeatureCropCenter(ray, type, 1.6);
            expect(center.x).toBeCloseTo(100);
            // Angle 0: ray goes upwards (-sin=0, cos=1), length = 4 * 16 = 64, offset / 2 = 32
            expect(center.y).toBeCloseTo(132);
        });
    });
});

describe("Callout Placement Algorithms", () => {
    it("computes feature bounds accurately", () => {
        const features = [
            new PointMarking(1, { x: 100, y: 150 }, "type-1"),
            new PointMarking(2, { x: 50, y: 200 }, "type-1"),
            new PointMarking(3, { x: 250, y: 80 }, "type-1"),
        ];
        const bounds = getFeatureBounds(features, 500, 500);
        expect(bounds).toEqual({
            minX: 50,
            maxX: 250,
            minY: 80,
            maxY: 200,
        });
    });

    it("determines initial side from angle relative to diagonal", () => {
        const diagAngle = Math.PI / 4;
        expect(determineInitialSide(0, diagAngle)).toBe("right");
        expect(determineInitialSide(Math.PI / 2, diagAngle)).toBe("bottom");
        expect(determineInitialSide(-Math.PI / 2, diagAngle)).toBe("top");
        expect(determineInitialSide(Math.PI, diagAngle)).toBe("left");
    });

    it("initializes placement with edge offset", () => {
        const feature = new PointMarking(1, { x: 100, y: 100 }, "type-1");
        const bounds = { minX: 50, maxX: 150, minY: 50, maxY: 150 };
        const placement = getInitialPlacement(
            feature,
            bounds,
            0,
            0,
            50,
            50,
            50,
            250,
            250,
            200,
            200,
            24
        );
        expect(["top", "bottom", "left", "right"]).toContain(placement.side);
        expect(placement.feature).toBe(feature);
    });

    it("balances overcrowded sides", () => {
        const features = Array.from(
            { length: 10 },
            (_, i) => new PointMarking(i + 1, { x: 50 + i * 10, y: 20 }, "t")
        );
        const bounds = getFeatureBounds(features, 500, 500);
        const placements = features.map(f =>
            getInitialPlacement(
                f,
                bounds,
                0,
                0,
                50,
                50,
                50,
                250,
                250,
                200,
                200,
                24
            )
        );

        expect(() => {
            balanceSides(placements, 0, 0, 50, 50, 250, 50, 250, 24);
        }).not.toThrow();
    });
});
